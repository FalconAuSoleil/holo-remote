import { DurableObject } from "cloudflare:workers";
import { Conductor, type Peer } from "./application/conductor";
import { ROOM_RE, phoneMessageSchema } from "./domain/protocol";
import { VOCABULARY } from "./domain/vocabulary";
import { gladiaTranscriber } from "./infrastructure/gladia";
import { workerConnect } from "./infrastructure/gladia-worker";
import { hApi } from "./infrastructure/h-api";
import { linkupSearch } from "./infrastructure/linkup";

interface Env {
  SESSION: DurableObjectNamespace<Session>;
  GLADIA_API_KEY: string;
  GLADIA_LANGUAGE?: string;
  LINKUP_API_KEY?: string;
  H_API_BASE?: string;
  VOICE_BUDGET_S?: string;
}

const MAX_AUDIO_CHUNK = 64 * 1024;

// L'identifiant de la pièce est le hachage « pont:clé » calculé par le navigateur : le serveur ne reçoit la clé
// que dans le premier message, la garde en mémoire le temps de la connexion et ne la journalise ni ne la stocke.
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket attendu", { status: 426 });
    const room = url.searchParams.get("room") ?? "";
    if (!ROOM_RE.test(room)) return new Response("Requête invalide", { status: 400 });
    const origin = req.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) return new Response("Origine refusée", { status: 403 });
    return env.SESSION.get(env.SESSION.idFromName(room)).fetch(req);
  },
} satisfies ExportedHandler<Env>;

export class Session extends DurableObject<Env> {
  private conductor: Conductor;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.conductor = new Conductor({
      makeH: (apiKey) => hApi({ apiKey, baseUrl: env.H_API_BASE }),
      search: env.LINKUP_API_KEY ? linkupSearch(env.LINKUP_API_KEY) : undefined,
      transcribe: gladiaTranscriber({ connect: workerConnect, apiKey: env.GLADIA_API_KEY, language: env.GLADIA_LANGUAGE ?? "fr", vocabulary: VOCABULARY }),
      limits: { maxRecordingMs: 30_000, voiceBudgetMs: Number(env.VOICE_BUDGET_S ?? 600) * 1000 },
    });
  }

  override async fetch(req: Request): Promise<Response> {
    const room = new URL(req.url).searchParams.get("room") ?? "";
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    server.accept();
    server.binaryType = "arraybuffer"; // sinon l'audio arrive en Blob et est ignoré
    const peer: Peer = { send: (msg) => server.send(JSON.stringify(msg)), sendBinary: (data) => server.send(data) };
    const phone = this.conductor.attach(room, peer);

    server.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return ev.data.byteLength <= MAX_AUDIO_CHUNK ? phone.audio(new Uint8Array(ev.data)) : undefined;
      let json: unknown;
      try {
        json = JSON.parse(ev.data);
      } catch {
        return;
      }
      const parsed = phoneMessageSchema.safeParse(json);
      if (parsed.success) void phone.message(parsed.data).catch((err) => peer.send({ type: "error", text: String(err) }));
    });
    server.addEventListener("close", () => phone.close());
    server.addEventListener("error", () => phone.close());
    return new Response(null, { status: 101, webSocket: client });
  }
}
