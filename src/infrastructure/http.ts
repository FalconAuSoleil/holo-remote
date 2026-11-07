import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Relay } from "../application/relay";
import { SESSION_RE, phoneMessageSchema, pcMessageSchema } from "../domain/protocol";

interface Options {
  relay: Relay;
  // Sans jeton, le relais est public : n'importe quel PC peut ouvrir une session.
  pcToken?: string;
  allowedOrigins?: string[];
  maxConnsPerIp?: number;
  trustProxy?: boolean;
  port: number;
  host?: string;
}

const MAX_AUDIO_CHUNK = 64 * 1024;
const MAX_FRAME = 8 * 1024 * 1024;
const MAX_BUFFERED = 2 * 1024 * 1024; // au-delà, on saute des images plutôt que d'accumuler du retard

export function startHttp({ relay, pcToken, allowedOrigins = [], maxConnsPerIp = 8, trustProxy = false, port, host = "0.0.0.0" }: Options): Server {
  const app = new Hono();
  const page = readFile(new URL("../../web/index.html", import.meta.url), "utf8");
  app.get("/", async (c) => c.html(await page));
  const config = readFile(new URL("../../web/config.js", import.meta.url), "utf8");
  app.get("/config.js", async (c) => c.body(await config, 200, { "content-type": "text/javascript; charset=utf-8" }));
  app.get("/health", (c) => c.json({ ok: true }));

  const server = serve({ fetch: app.fetch, port, hostname: host }) as Server;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME });

  const conns = new Map<string, number>();

  server.on("upgrade", (req, socket, head) => {
    const refuse = (code: string) => {
      socket.write(`HTTP/1.1 ${code}\r\n\r\n`);
      socket.destroy();
    };
    const url = new URL(req.url ?? "/", "http://x");
    const session = url.searchParams.get("session") ?? "";
    const role = url.searchParams.get("role");
    if (url.pathname !== "/ws" || !SESSION_RE.test(session) || (role !== "phone" && role !== "pc")) return refuse("400 Bad Request");

    if (role === "pc") {
      if (pcToken && url.searchParams.get("token") !== pcToken) return refuse("401 Unauthorized");
      if (!relay.canCreate(session)) return refuse("503 Service Unavailable");
    } else {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.length && !allowedOrigins.includes(origin) && new URL(origin).host !== req.headers.host) {
        return refuse("403 Forbidden");
      }
      if (!relay.hasPc(session)) return refuse("404 Not Found");
    }

    const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
    const ip = (trustProxy && forwarded) || req.socket.remoteAddress || "?";
    if ((conns.get(ip) ?? 0) >= maxConnsPerIp) return refuse("429 Too Many Requests");
    conns.set(ip, (conns.get(ip) ?? 0) + 1);

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on("close", () => {
        const n = (conns.get(ip) ?? 1) - 1;
        if (n <= 0) conns.delete(ip);
        else conns.set(ip, n);
      });
      if (role === "pc") onPc(ws, session);
      else onPhone(ws, session);
    });
  });

  const sendJson = (ws: WebSocket) => (msg: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

  function onPhone(ws: WebSocket, session: string) {
    const phone = relay.attachPhone(session, {
      send: sendJson(ws),
      sendBinary: (d) => ws.readyState === ws.OPEN && ws.bufferedAmount < MAX_BUFFERED && ws.send(d, { binary: true }),
    });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return (data as Buffer).length <= MAX_AUDIO_CHUNK ? phone.audio(new Uint8Array(data as Buffer)) : undefined;
      const parsed = phoneMessageSchema.safeParse(safeJson(data.toString()));
      if (parsed.success) phone.message(parsed.data);
    });
    ws.on("close", () => phone.close());
  }

  function onPc(ws: WebSocket, session: string) {
    const pc = relay.attachPc(session, { send: sendJson(ws) });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return pc.frame(new Uint8Array(data as Buffer));
      const parsed = pcMessageSchema.safeParse(safeJson(data.toString()));
      if (parsed.success) pc.message(parsed.data);
    });
    ws.on("close", () => pc.close());
  }

  return server;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
