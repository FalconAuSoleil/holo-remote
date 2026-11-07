import { type AgentEvent, type PcMessage, type PhoneMessage, type ToPc, type ToPhone } from "../domain/protocol";

export interface Peer<T> {
  send(msg: T): void;
}

export interface Transcriber {
  push(chunk: Uint8Array<ArrayBuffer>): void;
  // Termine l'enregistrement et renvoie le texte final.
  finish(): Promise<string>;
}
export type TranscriberFactory = (onPartial: (text: string) => void) => Transcriber;

// Le téléphone reçoit aussi les images de l'écran du PC en binaire.
export interface PhonePeer extends Peer<ToPhone> {
  sendBinary(data: Uint8Array): void;
}

interface Session {
  pc?: Peer<ToPc>;
  phones: Set<PhonePeer>;
  nextId: number;
  voiceMs: number; // durée de voix déjà transcrite (budget de la démo publique)
}

export interface RelayLimits {
  maxRecordingMs: number; // coupe un appui trop long
  sessionVoiceBudgetMs: number; // quota de voix par session
  maxSessions: number;
}
export const NO_LIMITS: RelayLimits = { maxRecordingMs: 60_000, sessionVoiceBudgetMs: Infinity, maxSessions: Infinity };

export interface PhoneHandle {
  message(msg: PhoneMessage): void;
  audio(chunk: Uint8Array<ArrayBuffer>): void;
  close(): void;
}

// Un relais par session : un PC, plusieurs téléphones. La transcription reste côté serveur (la clé Gladia ne sort jamais).
export class Relay {
  private sessions = new Map<string, Session>();
  constructor(
    private transcribe: TranscriberFactory,
    private limits: RelayLimits = NO_LIMITS,
    private now: () => number = Date.now,
  ) {}

  hasPc(id: string): boolean {
    return !!this.sessions.get(id)?.pc;
  }

  canCreate(id: string): boolean {
    return this.sessions.has(id) || this.sessions.size < this.limits.maxSessions;
  }

  private session(id: string): Session {
    let s = this.sessions.get(id);
    if (!s) this.sessions.set(id, (s = { phones: new Set(), nextId: 1, voiceMs: 0 }));
    return s;
  }

  private toPhones(s: Session, msg: ToPhone) {
    for (const p of s.phones) p.send(msg);
  }

  attachPc(id: string, pc: Peer<ToPc>): { message(msg: PcMessage): void; frame(data: Uint8Array): void; close(): void } {
    const s = this.session(id);
    s.pc = pc;
    this.toPhones(s, { type: "pc", connected: true });
    return {
      message: (msg) => this.toPhones(s, { type: "agent", event: msg.event satisfies AgentEvent }),
      frame: (data) => {
        if (s.pc === pc) for (const p of s.phones) p.sendBinary(data);
      },
      close: () => {
        if (s.pc !== pc) return;
        s.pc = undefined;
        this.toPhones(s, { type: "pc", connected: false });
        this.gc(id);
      },
    };
  }

  attachPhone(id: string, phone: PhonePeer): PhoneHandle {
    const s = this.session(id);
    s.phones.add(phone);
    phone.send({ type: "pc", connected: !!s.pc });
    let rec: Transcriber | undefined;
    let startedAt = 0;
    let cap: ReturnType<typeof setTimeout> | undefined;

    const dispatch = (text: string) => {
      if (!s.pc) return phone.send({ type: "error", text: "Le PC n'est pas connecté à cette session." });
      s.pc.send({ type: "instruction", id: s.nextId++, text });
    };

    const endVoice = () => {
      const r = rec;
      if (!r) return;
      rec = undefined;
      if (cap) clearTimeout(cap);
      s.voiceMs += this.now() - startedAt;
      r.finish().then(
        (text) => {
          if (!text.trim()) return phone.send({ type: "error", text: "Rien compris, réessaie." });
          phone.send({ type: "transcript", text });
          dispatch(text);
        },
        (err) => phone.send({ type: "error", text: `Transcription : ${err instanceof Error ? err.message : err}` }),
      );
    };

    return {
      message: (msg) => {
        switch (msg.type) {
          case "voice-start":
            if (rec) break;
            if (s.voiceMs >= this.limits.sessionVoiceBudgetMs) {
              return phone.send({ type: "error", text: "Quota de voix de la démo atteint pour cette session." });
            }
            rec = this.transcribe((text) => phone.send({ type: "partial", text }));
            startedAt = this.now();
            cap = setTimeout(endVoice, this.limits.maxRecordingMs);
            break;
          case "voice-end":
            endVoice();
            break;
          case "text":
            phone.send({ type: "transcript", text: msg.text });
            dispatch(msg.text);
            break;
          case "cancel":
            s.pc?.send({ type: "cancel" });
            break;
        }
      },
      audio: (chunk) => rec?.push(chunk),
      close: () => {
        s.phones.delete(phone);
        if (cap) clearTimeout(cap);
        rec?.finish().catch(() => {});
        rec = undefined;
        this.gc(id);
      },
    };
  }

  private gc(id: string) {
    const s = this.sessions.get(id);
    if (s && !s.pc && s.phones.size === 0) this.sessions.delete(id);
  }
}
