interface LiveOptions {
  apiKey: string;
  language: string;
  vocabulary?: unknown[]; // mots à privilégier (noms d'applications, etc.)
  fetchImpl?: typeof fetch;
}

// STT en direct Gladia : POST /v2/live renvoie une URL WebSocket (jeton inclus) à laquelle le navigateur envoie
// directement du PCM 16 bits 16 kHz mono. La clé Gladia reste sur le serveur.
export async function gladiaLiveUrl(opts: LiveOptions): Promise<string> {
  const res = await (opts.fetchImpl ?? fetch)("https://api.gladia.io/v2/live", {
    method: "POST",
    headers: { "x-gladia-key": opts.apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      encoding: "wav/pcm",
      bit_depth: 16,
      sample_rate: 16000,
      channels: 1,
      language_config: { languages: [opts.language], code_switching: false },
      messages_config: { receive_partial_transcripts: true, receive_final_transcripts: true },
      ...(opts.vocabulary?.length
        ? { realtime_processing: { custom_vocabulary: true, custom_vocabulary_config: { vocabulary: opts.vocabulary, default_intensity: 0.3 } } }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Gladia ${res.status}`);
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("Gladia : pas d'adresse de transcription");
  return url;
}
