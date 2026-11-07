import { describe, expect, it, vi } from "vitest";
import { Conductor, type Peer, type Transcriber } from "./conductor";
import type { Changes, HPort } from "./ports";
import { type ToPhone, roomId } from "../domain/protocol";

const SESSION = "dbaf2955-d207-4413-8bc8-1d4706d01d64";
const KEY = "hai-key-de-test";

function fakeH(script: (Changes | null)[]) {
  const calls: string[] = [];
  const results: unknown[] = [];
  let created: unknown;
  const h: HPort = {
    createSession: async (i) => ((created = i), calls.push("create"), "s1"),
    sendMessage: async (_id, t) => void calls.push(`msg:${t}`),
    changes: async () => script.shift() ?? { status: "completed", answer: "fin" },
    toolResult: async (_id, c, o) => void results.push({ id: c.id, ...o }),
    cancel: async () => void calls.push("cancel"),
  };
  return { h, calls, results, created: () => created };
}

const phone = () => {
  const got: ToPhone[] = [];
  const peer: Peer = { send: (m) => void got.push(m) };
  return { got, peer };
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const silent = { push() {}, finish: async () => "ouvre le bloc-notes" } satisfies Transcriber;

async function setup(script: (Changes | null)[], opts: { search?: boolean; budgetMs?: number } = {}) {
  const f = fakeH(script);
  const conductor = new Conductor({
    makeH: () => f.h,
    search: opts.search ? { search: async (q) => `réponse sur ${q}` } : undefined,
    transcribe: () => silent,
    limits: { maxRecordingMs: 1000, voiceBudgetMs: opts.budgetMs ?? 10_000 },
    sleep: async () => {},
  });
  const p = phone();
  const handle = conductor.attach(await roomId(SESSION, KEY), p.peer);
  await handle.message({ type: "hello", session: SESSION, key: KEY });
  return { ...f, p, handle };
}

describe("Conductor", () => {
  it("refuse une connexion dont la pièce ne correspond pas au pont et à la clé", async () => {
    const conductor = new Conductor({ makeH: () => fakeH([]).h, transcribe: () => silent, limits: { maxRecordingMs: 1, voiceBudgetMs: 1 } });
    const p = phone();
    const handle = conductor.attach("0".repeat(64), p.peer);
    await handle.message({ type: "hello", session: SESSION, key: KEY });
    expect(p.got[0]).toMatchObject({ type: "error" });
  });

  it("refuse toute instruction avant la connexion", async () => {
    const conductor = new Conductor({ makeH: () => fakeH([]).h, transcribe: () => silent, limits: { maxRecordingMs: 1, voiceBudgetMs: 1 } });
    const p = phone();
    await conductor.attach("0".repeat(64), p.peer).message({ type: "text", text: "salut" });
    expect(p.got[0]).toMatchObject({ type: "error" });
  });

  it("crée la session H avec le pont de l'utilisateur, relaie actions, capture et réponse", async () => {
    const t = await setup([
      {
        status: "running",
        first_index: 0,
        new_events: [
          { type: "AgentEvent", data: { kind: "observation_event", image: { source: "https://s3.test/1.png" } } },
          { type: "AgentEvent", data: { kind: "policy_event", thought: "Je clique sur Démarrer" } },
        ],
      },
      { status: "completed", answer: "Bloc-notes ouvert" },
    ]);
    await t.handle.message({ type: "text", text: "ouvre le bloc-notes" });
    await vi.waitFor(() => expect(t.p.got.at(-1)).toEqual({ type: "agent", event: { kind: "done", text: "Bloc-notes ouvert" } }));
    expect(JSON.stringify(t.created())).toContain(SESSION);
    expect(t.p.got).toContainEqual({ type: "frame", url: "https://s3.test/1.png" });
    expect(t.p.got).toContainEqual({ type: "agent", event: { kind: "step", text: "Je clique sur Démarrer" } });
  });

  it("réutilise la session pour l'instruction suivante", async () => {
    const t = await setup([{ status: "completed", answer: "a" }, { status: "completed", answer: "b" }]);
    await t.handle.message({ type: "text", text: "un" });
    await vi.waitFor(() => expect(t.p.got.some((m) => m.type === "agent" && m.event.kind === "done")).toBe(true));
    await tick();
    await t.handle.message({ type: "text", text: "deux" });
    await vi.waitFor(() => expect(t.calls).toEqual(["create", "msg:deux"]));
  });

  it("exécute l'outil de recherche et renvoie le résultat à l'agent comme donnée", async () => {
    const t = await setup(
      [{ status: "running", pending_tool_calls: [{ tool_name: "web_research", args: { query: "prix du cuivre" }, id: "c1" }] }, { status: "completed", answer: "ok" }],
      { search: true },
    );
    await t.handle.message({ type: "text", text: "cherche" });
    await vi.waitFor(() => expect(t.results).toHaveLength(1));
    expect(t.results[0]).toEqual({ id: "c1", result: "<donnees>réponse sur prix du cuivre</donnees>" });
  });

  it("signale une erreur H de façon lisible", async () => {
    const f = fakeH([]);
    f.h.createSession = async () => {
      throw new Error("H 401 : unauthorized");
    };
    const conductor = new Conductor({ makeH: () => f.h, transcribe: () => silent, limits: { maxRecordingMs: 1000, voiceBudgetMs: 1000 } });
    const p = phone();
    const handle = conductor.attach(await roomId(SESSION, KEY), p.peer);
    await handle.message({ type: "hello", session: SESSION, key: KEY });
    await handle.message({ type: "text", text: "x" });
    await vi.waitFor(() => expect(JSON.stringify(p.got.at(-1))).toContain("Clé H refusée"));
  });

  it("transcrit la voix puis envoie l'instruction, et épuise le quota de voix", async () => {
    vi.useFakeTimers();
    try {
      const f = fakeH([{ status: "completed", answer: "ok" }]);
      const conductor = new Conductor({
        makeH: () => f.h,
        transcribe: () => silent,
        limits: { maxRecordingMs: 1000, voiceBudgetMs: 1000 },
        sleep: async () => {},
      });
      const p = phone();
      const handle = conductor.attach(await roomId(SESSION, KEY), p.peer);
      await handle.message({ type: "hello", session: SESSION, key: KEY });
      await handle.message({ type: "voice-start" });
      await vi.advanceTimersByTimeAsync(1500); // jamais arrêté : coupé à 1 s
      expect(p.got).toContainEqual({ type: "transcript", text: "ouvre le bloc-notes" });
      expect(f.calls[0]).toBe("create");
      await handle.message({ type: "voice-start" });
      expect(JSON.stringify(p.got.at(-1))).toContain("Quota de voix");
    } finally {
      vi.useRealTimers();
    }
  });

  it("jette une prise de parole annulée sans rien envoyer à l'agent", async () => {
    const t = await setup([]);
    await t.handle.message({ type: "voice-start" });
    await t.handle.message({ type: "voice-cancel" });
    await tick();
    expect(t.calls).toEqual([]);
    expect(t.p.got.map((m) => m.type)).toEqual(["ready"]);
  });

  it("annule la session en cours", async () => {
    const t = await setup([{ status: "running" }, { status: "running" }, { status: "interrupted" }]);
    await t.handle.message({ type: "text", text: "x" });
    await t.handle.message({ type: "cancel" });
    expect(t.calls).toContain("cancel");
  });
});
