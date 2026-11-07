import { DurableObject } from "cloudflare:workers";
import { Relay, type PhonePeer } from "./application/relay";
import { SESSION_RE, pcMessageSchema, phoneMessageSchema } from "./domain/protocol";
import { gladiaTranscriber } from "./infrastructure/gladia";
import { workerConnect } from "./infrastructure/gladia-worker";

interface Env {
  SESSION: DurableObjectNamespace<Session>;
  GLADIA_API_KEY: string;
  GLADIA_LANGUAGE?: string;
  SESSION_VOICE_BUDGET_S?: string;
}

const MAX_AUDIO_CHUNK = 64 * 1024;
const MAX_FRAME = 1024 * 1024; // limite d'un message WebSocket dans un Worker

// Le Worker valide l'appel puis le confie à l'instance de la session : une instance par code,
// donc le PC et les téléphones d'une même session se retrouvent au même endroit.
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket attendu", { status: 426 });
    const session = url.searchParams.get("session") ?? "";
    const role = url.searchParams.get("role");
    if (!SESSION_RE.test(session) || (role !== "phone" && role !== "pc")) return new Response("Requête invalide", { status: 400 });
    const origin = req.headers.get("Origin");
    if (role === "phone" && origin && new URL(origin).host !== url.host) return new Response("Origine refusée", { status: 403 });
    return env.SESSION.get(env.SESSION.idFromName(session)).fetch(req);
  },
} satisfies ExportedHandler<Env>;

export class Session extends DurableObject<Env> {
  private relay: Relay;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.relay = new Relay(
      gladiaTranscriber({ connect: workerConnect, apiKey: env.GLADIA_API_KEY, language: env.GLADIA_LANGUAGE ?? "fr" }),
      {
        maxRecordingMs: 30_000,
        sessionVoiceBudgetMs: Number(env.SESSION_VOICE_BUDGET_S ?? 600) * 1000,
        maxSessions: Infinity,
      },
    );
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const session = url.searchParams.get("session") ?? "";
    const role = url.searchParams.get("role");
    if (role === "phone" && !this.relay.hasPc(session)) return new Response("Aucun PC connecté", { status: 404 });

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    server.accept();
    server.binaryType = "arraybuffer"; // sinon les messages binaires arrivent en Blob et sont ignorés
    const sendJson = (msg: unknown) => server.send(JSON.stringify(msg));
    const parse = (data: string | ArrayBuffer) => {
      try {
        return JSON.parse(String(data));
      } catch {
        return null;
      }
    };

    if (role === "pc") {
      const pc = this.relay.attachPc(session, { send: sendJson });
      server.addEventListener("message", (ev) => {
        if (typeof ev.data !== "string") return ev.data.byteLength <= MAX_FRAME ? pc.frame(new Uint8Array(ev.data)) : undefined;
        const parsed = pcMessageSchema.safeParse(parse(ev.data));
        if (parsed.success) pc.message(parsed.data);
      });
      server.addEventListener("close", () => pc.close());
      server.addEventListener("error", () => pc.close());
    } else {
      const peer: PhonePeer = { send: sendJson, sendBinary: (d) => server.send(d) };
      const phone = this.relay.attachPhone(session, peer);
      server.addEventListener("message", (ev) => {
        if (typeof ev.data !== "string") return ev.data.byteLength <= MAX_AUDIO_CHUNK ? phone.audio(new Uint8Array(ev.data)) : undefined;
        const parsed = phoneMessageSchema.safeParse(parse(ev.data));
        if (parsed.success) phone.message(parsed.data);
      });
      server.addEventListener("close", () => phone.close());
      server.addEventListener("error", () => phone.close());
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}
