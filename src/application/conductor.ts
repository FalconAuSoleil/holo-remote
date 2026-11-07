import { type FrameImage, type HEvent, answerText, describeStep, frameImage, toolCallsFrom } from "../domain/h-events";
import { type PhoneMessage, type ToPhone, roomId } from "../domain/protocol";
import type { HPort, SearchPort, ToolDeclaration } from "./ports";
import { SEARCH_TOOL } from "../infrastructure/h-api";

export interface Peer {
  send(msg: ToPhone): void;
  sendBinary(data: Uint8Array<ArrayBuffer>): void; // capture d'écran (image)
}

const MAX_FRAME_BYTES = 1_000_000; // un message WebSocket d'un Worker ne dépasse pas 1 Mio

export interface Transcriber {
  push(chunk: Uint8Array<ArrayBuffer>): void;
  finish(): Promise<string>;
}
// onText : texte déjà stabilisé (phrases finales). onReady : la transcription est connectée, on peut parler.
export type TranscriberFactory = (onText: (text: string) => void, onReady?: () => void) => Transcriber;

export interface Limits {
  maxRecordingMs: number;
  voiceBudgetMs: number;
}

export interface PhoneHandle {
  message(msg: PhoneMessage): Promise<void>;
  audio(chunk: Uint8Array<ArrayBuffer>): void;
  close(): void;
}

interface Deps {
  makeH: (apiKey: string) => HPort;
  search?: SearchPort; // sans lui, l'outil de recherche n'est pas proposé à l'agent
  transcribe: TranscriberFactory;
  limits: Limits;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const TERMINAL = new Set(["completed", "failed", "timed_out", "interrupted"]);
const MAX_ERRORS = 4;

// Une instance par pièce (hachage pont+clé) : les téléphones d'une même connexion partagent la même session H.
export class Conductor {
  private phones = new Set<Peer>();
  private h?: HPort;
  private bridgeId?: string;
  private sessionId?: string;
  private fromIndex = 0;
  private running = false;
  private voiceMs = 0;
  private handled = new Set<string>();
  private framing = false;
  private nextFrame?: FrameImage;
  private frameWarned = false;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(private deps: Deps) {
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private emit(msg: ToPhone) {
    for (const p of this.phones) p.send(msg);
  }

  attach(room: string, phone: Peer): PhoneHandle {
    this.phones.add(phone);
    let rec: Transcriber | undefined;
    let startedAt = 0;
    let cap: ReturnType<typeof setTimeout> | undefined;

    const endVoice = () => {
      const r = rec;
      if (!r) return;
      rec = undefined;
      if (cap) clearTimeout(cap);
      this.voiceMs += this.now() - startedAt;
      r.finish().then(
        (text) => {
          if (!text.trim()) return phone.send({ type: "error", text: "Rien compris, réessaie." });
          this.emit({ type: "transcript", text });
          void this.instruct(text, phone);
        },
        (err) => phone.send({ type: "error", text: `Transcription : ${err instanceof Error ? err.message : err}` }),
      );
    };

    return {
      message: async (msg) => {
        if (msg.type === "hello") {
          if ((await roomId(msg.session, msg.key)) !== room) {
            return phone.send({ type: "error", text: "Identifiants incohérents, reconnecte-toi." });
          }
          this.h ??= this.deps.makeH(msg.key);
          this.bridgeId = msg.session;
          return phone.send({ type: "ready" });
        }
        if (!this.h) return phone.send({ type: "error", text: "Entre d'abord ton code de session et ta clé." });
        switch (msg.type) {
          case "voice-start":
            if (rec) return;
            if (this.voiceMs >= this.deps.limits.voiceBudgetMs) {
              return phone.send({ type: "error", text: "Quota de voix de la démo atteint pour cette connexion." });
            }
            rec = this.deps.transcribe(
              (text) => phone.send({ type: "partial", text }),
              () => phone.send({ type: "listening" }),
            );
            startedAt = this.now();
            cap = setTimeout(endVoice, this.deps.limits.maxRecordingMs);
            return;
          case "voice-end":
            return endVoice();
          case "voice-cancel":
            if (cap) clearTimeout(cap);
            rec?.finish().catch(() => {}); // la prise de parole est jetée, rien n'est envoyé à l'agent
            rec = undefined;
            return;
          case "text":
            this.emit({ type: "transcript", text: msg.text });
            return this.instruct(msg.text, phone);
          case "cancel":
            return this.cancel(phone);
        }
      },
      audio: (chunk) => rec?.push(chunk),
      close: () => {
        this.phones.delete(phone);
        if (cap) clearTimeout(cap);
        rec?.finish().catch(() => {});
        rec = undefined;
      },
    };
  }

  private async instruct(text: string, phone: Peer) {
    const h = this.h;
    if (!h || !this.bridgeId) return;
    try {
      if (!this.sessionId) {
        const created = await h.createSession({ bridgeId: this.bridgeId, text, tools: this.tools() });
        this.sessionId = created.id;
        if (created.viewUrl) this.emit({ type: "session", url: created.viewUrl });
      } else {
        await h.sendMessage(this.sessionId, text);
      }
      this.emit({ type: "agent", event: { kind: "start", text } });
      if (!this.running) void this.follow(h);
    } catch (err) {
      phone.send({ type: "error", text: friendly(err) });
    }
  }

  private tools(): ToolDeclaration[] {
    return this.deps.search ? [SEARCH_TOOL] : [];
  }

  private async cancel(phone: Peer) {
    if (!this.h || !this.sessionId) return;
    try {
      await this.h.cancel(this.sessionId);
    } catch (err) {
      phone.send({ type: "error", text: friendly(err) });
    }
  }

  // Suit la session en direct : actions, captures d'écran, appels d'outils, fin.
  private async follow(h: HPort) {
    const sessionId = this.sessionId;
    if (!sessionId) return;
    this.running = true;
    let errors = 0;
    try {
      while (this.phones.size > 0) {
        let changes;
        try {
          changes = await h.changes(sessionId, this.fromIndex, 20);
          errors = 0;
        } catch (err) {
          if (++errors >= MAX_ERRORS) throw err;
          await this.sleep(1500);
          continue;
        }
        if (!changes) continue;

        const events: HEvent[] = changes.new_events ?? [];
        let lastImage: FrameImage | undefined;
        if (events.length) this.fromIndex = (changes.first_index ?? this.fromIndex) + events.length;
        for (const ev of events) {
          const image = frameImage(ev);
          if (image) lastImage = image;
          const step = describeStep(ev);
          if (step) this.emit({ type: "agent", event: { kind: "step", text: step } });
        }
        if (lastImage) void this.pushFrame(h, lastImage); // seule la dernière capture du lot est envoyée
        for (const call of toolCallsFrom(changes.pending_tool_calls)) await this.runTool(h, sessionId, call);

        if (TERMINAL.has(changes.status)) {
          if (changes.status === "completed") {
            // Un résultat autre que « success » (bloqué, partiel, infaisable) est dit clairement : il explique un ordre non exécuté.
            const note = changes.outcome && changes.outcome !== "success" ? ` (résultat : ${changes.outcome})` : "";
            this.emit({ type: "agent", event: { kind: "done", text: answerText(changes.answer) + note } });
          }
          else if (changes.status === "interrupted") this.emit({ type: "agent", event: { kind: "cancelled", text: "Annulé." } });
          else this.emit({ type: "agent", event: { kind: "error", text: changes.error || `Session ${changes.status}.` } });
          return;
        }
      }
    } catch (err) {
      this.emit({ type: "agent", event: { kind: "error", text: friendly(err) } });
    } finally {
      this.running = false;
    }
  }

  // Récupère la capture avec la clé de l'utilisateur et la pousse aux téléphones ; une seule récupération à la fois, la plus récente gagne.
  private async pushFrame(h: HPort, image: FrameImage) {
    if (this.framing) {
      this.nextFrame = image;
      return;
    }
    this.framing = true;
    try {
      const bytes = await h.image(image);
      if (bytes && bytes.length <= MAX_FRAME_BYTES) {
        for (const p of this.phones) p.sendBinary(bytes);
      } else if (!this.frameWarned) {
        this.frameWarned = true;
        this.emit({ type: "error", text: bytes ? "Capture d'écran trop lourde pour le direct." : "Capture d'écran indisponible." });
      }
    } catch {
      /* une capture manquée ne doit jamais interrompre l'agent */
    } finally {
      this.framing = false;
      const next = this.nextFrame;
      this.nextFrame = undefined;
      if (next) void this.pushFrame(h, next);
    }
  }

  private async runTool(h: HPort, sessionId: string, call: ReturnType<typeof toolCallsFrom>[number]) {
    if (this.handled.has(call.id)) return;
    this.handled.add(call.id);
    const query = typeof call.args.query === "string" ? call.args.query : "";
    this.emit({ type: "agent", event: { kind: "search", text: `Recherche : ${query}` } });
    try {
      if (call.tool_name !== SEARCH_TOOL.name || !this.deps.search || !query) throw new Error("outil indisponible");
      // Le résultat est une donnée pour l'agent, jamais une instruction.
      const result = await this.deps.search.search(query);
      await h.toolResult(sessionId, call, { result: `<donnees>${result}</donnees>` });
    } catch (err) {
      await h.toolResult(sessionId, call, { error: err instanceof Error ? err.message : String(err) }).catch(() => {});
    }
  }
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = /^H (\d{3})/.exec(msg)?.[1];
  if (status === "401" || status === "403") return `Clé H refusée. ${msg}`;
  if (status === "402") return `Crédit H insuffisant. ${msg}`;
  if (status === "404" || status === "422") return `H n'a pas accepté la demande (pont de bureau introuvable ?). ${msg}`;
  return msg;
}
