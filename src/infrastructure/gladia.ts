import type { Transcriber, TranscriberFactory } from "../application/relay";

interface GladiaOptions {
  apiKey: string;
  language: string;
  fetchImpl?: typeof fetch;
  // Délai max d'attente des transcriptions finales après l'arrêt de l'audio.
  finishTimeoutMs?: number;
}

// STT en direct Gladia : POST /v2/live renvoie une URL WebSocket, on y envoie du PCM 16 bits 16 kHz mono.
export function gladiaTranscriber(opts: GladiaOptions): TranscriberFactory {
  const doFetch = opts.fetchImpl ?? fetch;
  return (onPartial): Transcriber => {
    const finals: string[] = [];
    const pending: Uint8Array<ArrayBuffer>[] = [];
    let ws: WebSocket | undefined;
    let stopped = false;
    let failure: Error | undefined;
    let closed!: () => void;
    const closedP = new Promise<void>((r) => (closed = r));

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
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        for (const c of pending.splice(0)) ws!.send(c);
        if (stopped) ws!.send(JSON.stringify({ type: "stop_recording" }));
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        const msg = JSON.parse(ev.data) as { type?: string; data?: { is_final?: boolean; utterance?: { text?: string } } };
        const text = msg.data?.utterance?.text?.trim();
        if (msg.type === "transcript" && text) {
          if (msg.data?.is_final) finals.push(text);
          else onPartial(text);
        }
      };
      ws.onclose = () => closed();
      ws.onerror = () => {
        failure = new Error("connexion Gladia interrompue");
        closed();
      };
    })().catch((err) => {
      failure = err instanceof Error ? err : new Error(String(err));
      closed();
    });

    return {
      push(chunk: Uint8Array<ArrayBuffer>) {
        if (stopped) return;
        if (ws?.readyState === WebSocket.OPEN) ws.send(chunk);
        else pending.push(chunk);
      },
      async finish() {
        stopped = true;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop_recording" }));
        const timer = setTimeout(() => closed(), opts.finishTimeoutMs ?? 5000);
        await closedP;
        clearTimeout(timer);
        try {
          ws?.close();
        } catch {}
        if (failure && finals.length === 0) throw failure;
        return finals.join(" ");
      },
    };
  };
}
