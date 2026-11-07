import { expect, it } from "vitest";
import { type Connect, type SocketHandlers, gladiaTranscriber } from "./gladia";

it("envoie l'audio à Gladia, rassemble les phrases finales et relaie les partielles", async () => {
  const sent: unknown[] = [];
  let handlers!: SocketHandlers;
  const connect: Connect = async (url, h) => {
    expect(url).toBe("wss://live.test/x");
    handlers = h;
    return {
      send: (d) => {
        sent.push(d);
        if (typeof d === "string" && d.includes("stop_recording")) {
          handlers.message(JSON.stringify({ type: "transcript", data: { is_final: true, utterance: { text: "ouvre youtube" } } }));
          handlers.close();
        }
      },
      close: () => {},
    };
  };
  const fetchImpl = (async () => Response.json({ id: "1", url: "wss://live.test/x" })) as unknown as typeof fetch;
  const partials: string[] = [];
  const t = gladiaTranscriber({ apiKey: "k", language: "fr", connect, fetchImpl })((p) => partials.push(p));
  t.push(new Uint8Array([1, 2])); // avant l'ouverture : mis en attente
  await new Promise((r) => setTimeout(r, 0));
  handlers.message(JSON.stringify({ type: "transcript", data: { is_final: false, utterance: { text: "ouvre" } } }));
  expect(await t.finish()).toBe("ouvre youtube");
  expect(partials).toEqual(["ouvre"]);
  expect(sent[0]).toEqual(new Uint8Array([1, 2]));
});

it("signale une erreur Gladia", async () => {
  const fetchImpl = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
  const t = gladiaTranscriber({ apiKey: "bad", language: "fr", connect: async () => ({ send() {}, close() {} }), fetchImpl })(() => {});
  await expect(t.finish()).rejects.toThrow("Gladia 401");
});
