import { describe, expect, it } from "vitest";
import { answerText, describeStep, frameImage, toolCallsFrom } from "./h-events.js";

describe("événements H", () => {
  it("trouve l'image d'une observation, en url ou en base64, sinon rien", () => {
    const ev = (image: object) => ({ type: "AgentEvent", data: { type: "AgentEvent", data: { kind: "observation_event", image } } });
    expect(frameImage(ev({ type: "url", source: "https://s3.test/a.png", media_type: "image/png" }))).toEqual({ type: "url", source: "https://s3.test/a.png", mediaType: "image/png" });
    expect(frameImage(ev({ type: "url", source: "/api/v2/sessions/s/resources/screenshots/step-1.png" }))?.type).toBe("url");
    expect(frameImage(ev({ type: "base64", source: "AAAA", media_type: "image/jpeg" }))).toEqual({ type: "base64", source: "AAAA", mediaType: "image/jpeg" });
    expect(frameImage(ev({ type: "url", source: "http://x/a.png" }))).toBeNull();
    expect(frameImage({ type: "MetricsUpdateEvent", data: {} })).toBeNull();
    expect(frameImage({ type: "AgentEvent" })).toBeNull();
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
});
