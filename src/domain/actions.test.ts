import { describe, expect, it } from "vitest";
import { parseTextAction, parseToolCall, scalePoint } from "./actions";
import { SESSION_RE, newSessionId } from "./protocol";

describe("actions", () => {
  it("lit un appel d'outil JSON", () => {
    expect(parseToolCall("click", '{"x":10,"y":20}')).toEqual({ name: "click", x: 10, y: 20 });
  });
  it("refuse un appel invalide ou un JSON cassé", () => {
    expect(parseToolCall("click", '{"x":"a"}')).toBeNull();
    expect(parseToolCall("click", "{")).toBeNull();
    expect(parseToolCall("rm", "{}")).toBeNull();
  });
  it("lit les actions en texte", () => {
    expect(parseTextAction("Je clique : click(120, 340)")).toEqual({ name: "click", x: 120, y: 340 });
    expect(parseTextAction('type("bonjour")')).toEqual({ name: "type", text: "bonjour" });
    expect(parseTextAction("done('fini')")).toEqual({ name: "done", summary: "fini" });
    expect(parseTextAction("rien d'utile")).toBeNull();
  });
  it("remet les coordonnées à l'échelle de l'écran, bornées", () => {
    expect(scalePoint({ x: 500, y: 250 }, { width: 1000, height: 500 }, { width: 2000, height: 1000 })).toEqual({ x: 1000, y: 500 });
    expect(scalePoint({ x: 5000, y: -3 }, { width: 1000, height: 500 }, { width: 1000, height: 500 })).toEqual({ x: 999, y: 0 });
  });
  it("tire des identifiants de session valides", () => {
    expect(SESSION_RE.test(newSessionId())).toBe(true);
  });
});
