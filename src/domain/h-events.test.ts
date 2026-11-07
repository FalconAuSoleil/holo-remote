import { describe, expect, it } from "vitest";
import { answerText, describeStep, frameUrl, toolCallsFrom } from "./h-events";
import { roomId } from "./protocol";

describe("événements H", () => {
  it("trouve l'URL HTTPS d'une capture, sinon rien", () => {
    const ev = (source: string) => ({ type: "AgentEvent", data: { type: "AgentEvent", data: { kind: "observation_event", image: { type: "url", source } } } });
    expect(frameUrl(ev("https://s3.test/a.png"))).toBe("https://s3.test/a.png");
    expect(frameUrl(ev("http://x/a.png"))).toBeNull();
    expect(frameUrl({ type: "MetricsUpdateEvent", data: {} })).toBeNull();
    expect(frameUrl({ type: "AgentEvent" })).toBeNull();
  });
  it("décrit une décision de l'agent, avec des formes plausibles", () => {
    expect(describeStep({ type: "AgentEvent", data: { kind: "policy_event", thought: "J'ouvre le menu" } })).toBe("J'ouvre le menu");
    expect(describeStep({ type: "AgentEvent", data: { data: { kind: "policy_event", actions: [{ type: "click", x: 3, y: 4 }] } } })).toContain("click");
    expect(describeStep({ type: "AgentEvent", data: { kind: "observation_event" } })).toBeNull();
  });
  it("lit les réponses et les appels d'outils", () => {
    expect(answerText("ok")).toBe("ok");
    expect(answerText({ a: 1 })).toBe('{"a":1}');
    expect(answerText(null)).toBe("Terminé.");
    expect(toolCallsFrom([{ tool_name: "web_research", args: { query: "x" }, id: "c1" }, { nope: 1 }])).toEqual([{ tool_name: "web_research", args: { query: "x" }, id: "c1" }]);
    expect(toolCallsFrom(undefined)).toEqual([]);
  });
  it("calcule une pièce stable qui dépend du pont ET de la clé", async () => {
    const a = await roomId("pont-1234", "clé-secrète-1");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(await roomId("pont-1234", "clé-secrète-1")).toBe(a);
    expect(await roomId("pont-1234", "autre-clé-xx")).not.toBe(a);
  });
});
