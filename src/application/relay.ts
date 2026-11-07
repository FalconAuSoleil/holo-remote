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

interface Session {
  pc?: Peer<ToPc>;
  phones: Set<Peer<ToPhone>>;
  nextId: number;
}

export interface PhoneHandle {
  message(msg: PhoneMessage): void;
  audio(chunk: Uint8Array<ArrayBuffer>): void;
  close(): void;
}

// Un relais par session : un PC, plusieurs téléphones. La transcription reste côté serveur (la clé Gladia ne sort jamais).
export class Relay {
  private sessions = new Map<string, Session>();
  constructor(private transcribe: TranscriberFactory) {}

  private session(id: string): Session {
    let s = this.sessions.get(id);
    if (!s) this.sessions.set(id, (s = { phones: new Set(), nextId: 1 }));
    return s;
  }

  private toPhones(s: Session, msg: ToPhone) {
    for (const p of s.phones) p.send(msg);
  }

  attachPc(id: string, pc: Peer<ToPc>): { message(msg: PcMessage): void; close(): void } {
    const s = this.session(id);
    s.pc = pc;
    this.toPhones(s, { type: "pc", connected: true });
    return {
      message: (msg) => this.toPhones(s, { type: "agent", event: msg.event satisfies AgentEvent }),
      close: () => {
        if (s.pc !== pc) return;
        s.pc = undefined;
        this.toPhones(s, { type: "pc", connected: false });
        this.gc(id);
      },
    };
  }

  attachPhone(id: string, phone: Peer<ToPhone>): PhoneHandle {
    const s = this.session(id);
    s.phones.add(phone);
    phone.send({ type: "pc", connected: !!s.pc });
    let rec: Transcriber | undefined;

    const dispatch = (text: string) => {
      if (!s.pc) return phone.send({ type: "error", text: "Le PC n'est pas connecté à cette session." });
      s.pc.send({ type: "instruction", id: s.nextId++, text });
    };

    return {
      message: (msg) => {
        switch (msg.type) {
          case "voice-start":
            rec = this.transcribe((text) => phone.send({ type: "partial", text }));
            break;
          case "voice-end": {
            const r = rec;
            rec = undefined;
            r?.finish().then(
              (text) => {
                if (!text.trim()) return phone.send({ type: "error", text: "Rien compris, réessaie." });
                phone.send({ type: "transcript", text });
                dispatch(text);
              },
              (err) => phone.send({ type: "error", text: `Transcription : ${err instanceof Error ? err.message : err}` }),
            );
            break;
          }
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
        rec?.finish().catch(() => {});
        this.gc(id);
      },
    };
  }

  private gc(id: string) {
    const s = this.sessions.get(id);
    if (s && !s.pc && s.phones.size === 0) this.sessions.delete(id);
  }
}
