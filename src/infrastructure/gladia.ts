import type { Transcriber, TranscriberFactory } from "../application/conductor";

export interface SocketLike {
  send(data: string | Uint8Array<ArrayBuffer>): void;
  close(): void;
}
export interface SocketHandlers {
  message(text: string): void;
  close(): void;
  error(): void;
}
// Ouverture d'un WebSocket sortant : Node et Cloudflare Workers ne l'exposent pas de la même façon.
export type Connect = (url: string, handlers: SocketHandlers) => Promise<SocketLike>;

interface GladiaOptions {
  apiKey: string;
  language: string;
  connect: Connect;
  fetchImpl?: typeof fetch;
  // Délai max d'attente des transcriptions finales après l'arrêt de l'audio.
  finishTimeoutMs?: number;
}

// STT en direct Gladia : POST /v2/live renvoie une URL WebSocket, on y envoie du PCM 16 bits 16 kHz mono.
export function gladiaTranscriber(opts: GladiaOptions): TranscriberFactory {
  const doFetch = opts.fetchImpl ?? fetch;
  return (onText, onReady): Transcriber => {
    const finals: string[] = [];
    const pending: Uint8Array<ArrayBuffer>[] = [];
    let sock: SocketLike | undefined;
    let stopped = false;
    let failure: Error | undefined;
    let closed!: () => void;
    const closedP = new Promise<void>((r) => (closed = r));
    const stop = JSON.stringify({ type: "stop_recording" });

    (async () => {
      const res = await doFetch("https://api.gladia.io/v2/live", {
        method: "POST",
        headers: { "x-gladia-key": opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          encoding: "wav/pcm",
          bit_depth: 16,
          sample_rate: 16000,
          channels: 1,
          language_config: { languages: [opts.language], code_switching: false },
          messages_config: { receive_partial_transcripts: true, receive_final_transcripts: true },
        }),
      });
      if (!res.ok) throw new Error(`Gladia ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      sock = await opts.connect(url, {
        message(text) {
          const msg = JSON.parse(text) as { type?: string; data?: { is_final?: boolean; utterance?: { text?: string } } };
          const t = msg.data?.utterance?.text?.trim();
          // Les transcriptions partielles changent à chaque mot (« Pouvre le bloc naté… ») : on ne montre que les phrases finales.
          if (msg.type === "transcript" && t && msg.data?.is_final) {
            finals.push(t);
            onText(finals.join(" "));
          }
        },
        close: () => closed(),
        error() {
          failure = new Error("connexion Gladia interrompue");
          closed();
        },
      });
      for (const c of pending.splice(0)) sock.send(c);
      onReady?.();
      if (stopped) sock.send(stop);
    })().catch((err) => {
      failure = err instanceof Error ? err : new Error(String(err));
      closed();
    });

    return {
      push(chunk) {
        if (stopped) return;
        if (sock) sock.send(chunk);
        else pending.push(chunk);
      },
      async finish() {
        stopped = true;
        sock?.send(stop);
        const timer = setTimeout(() => closed(), opts.finishTimeoutMs ?? 5000);
        await closedP;
        clearTimeout(timer);
        try {
          sock?.close();
        } catch {}
        if (failure && finals.length === 0) throw failure;
        return finals.join(" ");
      },
    };
  };
}
