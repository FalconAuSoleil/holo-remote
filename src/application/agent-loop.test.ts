import { describe, expect, it } from "vitest";
import { type AgentDeps, runAgent, withLastImageOnly } from "./agent-loop";
import type { ChatMessage, ModelReply } from "./ports";
import type { AgentEvent } from "../domain/protocol";

function setup(replies: ModelReply[]) {
  const clicks: [number, number][] = [];
  const seen: ChatMessage[][] = [];
  const queries: string[] = [];
  const deps: AgentDeps = {
    screen: {
      capture: async () => ({ pngBase64: "AAA", width: 500, height: 250 }),
      screenSize: async () => ({ width: 1000, height: 500 }),
    },
    input: { click: async (x, y) => void clicks.push([x, y]), type: async () => {}, key: async () => {}, scroll: async () => {} },
    model: { next: async (m) => (seen.push(m), replies.shift() ?? { content: "", toolCalls: [] }) },
    search: { search: async (q) => (queries.push(q), "réponse") },
    maxSteps: 5,
    sleep: async () => {},
  };
  const events: AgentEvent[] = [];
  const run = (text = "ouvre le site") => runAgent(deps, text, new AbortController().signal, (e) => events.push(e));
  return { deps, clicks, seen, queries, events, run };
}
const call = (name: string, args: object): ModelReply => ({ content: "", toolCalls: [{ id: name, name, arguments: JSON.stringify(args) }] });

describe("runAgent", () => {
  it("clique à l'échelle de l'écran puis termine", async () => {
    const t = setup([call("click", { x: 100, y: 50 }), call("done", { summary: "ok" })]);
    await t.run();
    expect(t.clicks).toEqual([[200, 100]]);
    expect(t.events.map((e) => e.kind)).toEqual(["start", "step", "done"]);
  });
  it("passe la recherche Linkup comme donnée", async () => {
    const t = setup([call("search", { query: "prix du cuivre" }), call("done", { summary: "ok" })]);
    await t.run();
    expect(t.queries).toEqual(["prix du cuivre"]);
    expect(JSON.stringify(t.seen[1])).toContain("<donnees>réponse</donnees>");
  });
  it("accepte une action en texte sans appel d'outil", async () => {
    const t = setup([{ content: "click(10, 10)", toolCalls: [] }, { content: "done(fini)", toolCalls: [] }]);
    await t.run();
    expect(t.clicks).toHaveLength(1);
    expect(t.events.at(-1)?.kind).toBe("done");
  });
  it("s'arrête au nombre maximal d'étapes", async () => {
    const t = setup(Array.from({ length: 10 }, () => call("wait", { ms: 10 })));
    await t.run();
    expect(t.events.at(-1)?.kind).toBe("error");
  });
  it("respecte l'annulation", async () => {
    const t = setup([call("done", { summary: "x" })]);
    const ctl = new AbortController();
    ctl.abort();
    const events: AgentEvent[] = [];
    await runAgent(t.deps, "x", ctl.signal, (e) => events.push(e));
    expect(events.at(-1)?.kind).toBe("cancelled");
  });
  it("ne garde que la dernière capture", () => {
    const img = (): ChatMessage => ({ role: "user", content: [{ type: "image", pngBase64: "X" }] });
    const out = withLastImageOnly([img(), img()]);
    expect(JSON.stringify(out[0])).not.toContain('"image"');
    expect(JSON.stringify(out[1])).toContain('"image"');
  });
});
