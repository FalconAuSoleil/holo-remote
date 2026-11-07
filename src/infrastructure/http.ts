import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Relay } from "../application/relay";
import { SESSION_RE, phoneMessageSchema, pcMessageSchema } from "../domain/protocol";

interface Options {
  relay: Relay;
  pcToken: string;
  port: number;
  host?: string;
}

const MAX_AUDIO_CHUNK = 64 * 1024;

export function startHttp({ relay, pcToken, port, host = "0.0.0.0" }: Options): Server {
  const app = new Hono();
  const page = readFile(new URL("../../web/index.html", import.meta.url), "utf8");
  app.get("/", async (c) => c.html(await page));
  app.get("/health", (c) => c.json({ ok: true }));

  const server = serve({ fetch: app.fetch, port, hostname: host }) as Server;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_AUDIO_CHUNK });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://x");
    const session = url.searchParams.get("session") ?? "";
    const role = url.searchParams.get("role");
    const authorized =
      SESSION_RE.test(session) &&
      (role === "phone" || (role === "pc" && url.searchParams.get("token") === pcToken));
    if (url.pathname !== "/ws" || !authorized) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => (role === "pc" ? onPc(ws, session) : onPhone(ws, session)));
  });

  const sendJson = (ws: WebSocket) => (msg: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

  function onPhone(ws: WebSocket, session: string) {
    const phone = relay.attachPhone(session, { send: sendJson(ws) });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return phone.audio(new Uint8Array(data as Buffer));
      const parsed = phoneMessageSchema.safeParse(safeJson(data.toString()));
      if (parsed.success) phone.message(parsed.data);
    });
    ws.on("close", () => phone.close());
  }

  function onPc(ws: WebSocket, session: string) {
    const pc = relay.attachPc(session, { send: sendJson(ws) });
    ws.on("message", (data) => {
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
