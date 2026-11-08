import { expect, it } from "vitest";
import { gladiaLiveUrl } from "./gladia.js";

const withFetch = (res: () => Response) => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => (seen.push({ url, init }), res())) as unknown as typeof fetch;
  return { seen, fetchImpl };
};

it("ouvre une transcription PCM 16 kHz avec la clé et le vocabulaire, et rend l'adresse WebSocket", async () => {
  const f = withFetch(() => Response.json({ id: "1", url: "wss://live.test/x" }));
  expect(await gladiaLiveUrl({ apiKey: "k", language: "fr", vocabulary: ["Chrome"], fetchImpl: f.fetchImpl })).toBe("wss://live.test/x");
  const body = JSON.parse(String(f.seen[0]!.init.body));
  expect((f.seen[0]!.init.headers as Record<string, string>)["x-gladia-key"]).toBe("k");
  expect(body).toMatchObject({ encoding: "wav/pcm", sample_rate: 16000, language_config: { languages: ["fr"] } });
  expect(body.realtime_processing.custom_vocabulary_config.vocabulary).toEqual(["Chrome"]);
});

it("échoue clairement si Gladia refuse", async () => {
  await expect(gladiaLiveUrl({ apiKey: "k", language: "fr", fetchImpl: withFetch(() => new Response("no", { status: 401 })).fetchImpl })).rejects.toThrow("Gladia 401");
});
