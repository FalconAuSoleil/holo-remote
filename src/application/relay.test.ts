import { describe, expect, it } from "vitest";
import type { PendingToolCall } from "../domain/h-events.js";
import { type Poll, friendly, pollSession } from "./relay.js";
import type { Changes, HPort } from "./ports.js";

function fakeH(changes: Changes | null) {
  const results: unknown[] = [];
  const h = {
    changes: async () => changes,
    toolResult: async (_id: string, c: PendingToolCall, o: unknown) => void results.push({ id: c.id, ...(o as object) }),
  } as unknown as HPort;
  return { h, results };
}
const q = { sessionId: "s1", from: 0, wait: 0, handled: [] as string[] };
const obs = (n: number) => ({ type: "AgentEvent", data: { kind: "observation_event", image: { type: "url", source: `https://s3.test/${n}.png` } } });
const policy = (thought: string) => ({ type: "AgentEvent", data: { type: "AgentEvent", data: { kind: "policy_event", thought } } });

describe("pollSession", () => {
  it("ne renvoie rien quand rien ne change", async () => {
    expect(await pollSession(fakeH(null).h, undefined, { ...q, from: 3 })).toEqual({ events: [], frames: [], next: 3, finished: false, handled: [] });
  });

  it("traduit les étapes, garde toutes les captures dans l'ordre et avance l'index", async () => {
    const p = await pollSession(fakeH({ status: "running", first_index: 4, new_events: [policy("Je clique sur Démarrer"), obs(1), obs(2)] }).h, undefined, q);
    expect(p.events).toEqual([{ kind: "step", text: "Je clique sur Démarrer" }]);
    expect(p.frames.map((f) => f.source)).toEqual(["https://s3.test/1.png", "https://s3.test/2.png"]);
    expect(p.next).toBe(7);
    expect(p.finished).toBe(false);
  });

  it("donne la réponse finale et termine", async () => {
    const p: Poll = await pollSession(fakeH({ status: "completed", answer: "Bloc-notes ouvert" }).h, undefined, q);
    expect(p).toMatchObject({ finished: true, events: [{ kind: "done", text: "Bloc-notes ouvert" }] });
  });

  it("dit clairement quand l'agent n'a pas réussi", async () => {
    const p = await pollSession(fakeH({ status: "completed", answer: "Je n'ai pas pu fermer la fenêtre", outcome: "blocked" }).h, undefined, q);
    expect(p.events[0]!.text).toContain("(résultat : blocked)");
  });

  it("signale l'annulation et les erreurs", async () => {
    expect((await pollSession(fakeH({ status: "interrupted" }).h, undefined, q)).events).toEqual([{ kind: "cancelled", text: "Annulé." }]);
    expect((await pollSession(fakeH({ status: "failed", error: "panne" }).h, undefined, q)).events).toEqual([{ kind: "error", text: "panne" }]);
  });

  it("exécute l'outil de recherche une seule fois et rend le résultat comme donnée", async () => {
    const call = { tool_name: "web_research", args: { query: "prix du cuivre" }, id: "c1" };
    const t = fakeH({ status: "running", pending_tool_calls: [call] });
    const search = { search: async (s: string) => `réponse sur ${s}` };
    const first = await pollSession(t.h, search, q);
    expect(first.events).toEqual([{ kind: "search", text: "Recherche : prix du cuivre" }]);
    expect(first.handled).toEqual(["c1"]);
    expect(t.results).toEqual([{ id: "c1", result: "<donnees>réponse sur prix du cuivre</donnees>" }]);
    const again = await pollSession(t.h, search, { ...q, handled: first.handled });
    expect(again.events).toEqual([]);
    expect(t.results).toHaveLength(1);
  });

  it("répond par une erreur quand l'outil est indisponible", async () => {
    const t = fakeH({ status: "running", pending_tool_calls: [{ tool_name: "web_research", args: { query: "x" }, id: "c2" }] });
    await pollSession(t.h, undefined, q);
    expect(t.results).toEqual([{ id: "c2", error: "outil indisponible" }]);
  });
});

it("traduit les erreurs de H en messages lisibles", () => {
  expect(friendly(new Error("H 401 : no"))).toContain("Clé H refusée");
  expect(friendly(new Error("H 402 : no"))).toContain("Crédit H insuffisant");
  expect(friendly(new Error("H 404 : no"))).toContain("pont de bureau introuvable");
  expect(friendly(new Error("autre"))).toBe("autre");
});
