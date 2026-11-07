import { describe, expect, it } from "vitest";
import { Relay, type Transcriber } from "./relay";
import type { ToPc, ToPhone } from "../domain/protocol";

const fakeRelay = (text = "ouvre youtube") =>
  new Relay((): Transcriber => ({ push() {}, finish: async () => text }));
const peer = <T>() => {
  const got: T[] = [];
  return { got, send: (m: T) => void got.push(m) };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("Relay", () => {
  it("transmet l'instruction vocale au PC de la même session", async () => {
    const relay = fakeRelay();
    const pc = peer<ToPc>();
    const phone = peer<ToPhone>();
    relay.attachPc("aaaaaaaaaa", pc);
    const h = relay.attachPhone("aaaaaaaaaa", phone);
    h.message({ type: "voice-start" });
    h.message({ type: "voice-end" });
    await tick();
    expect(pc.got).toEqual([{ type: "instruction", id: 1, text: "ouvre youtube" }]);
    expect(phone.got).toContainEqual({ type: "transcript", text: "ouvre youtube" });
  });
  it("isole les sessions", async () => {
    const relay = fakeRelay();
    const other = peer<ToPc>();
    relay.attachPc("bbbbbbbbbb", other);
    const phone = peer<ToPhone>();
    relay.attachPhone("aaaaaaaaaa", phone).message({ type: "text", text: "salut" });
    expect(other.got).toEqual([]);
    expect(phone.got).toContainEqual({ type: "error", text: "Le PC n'est pas connecté à cette session." });
  });
  it("relaie les événements de l'agent et l'état du PC", () => {
    const relay = fakeRelay();
    const phone = peer<ToPhone>();
    relay.attachPhone("aaaaaaaaaa", phone);
    const pc = relay.attachPc("aaaaaaaaaa", peer<ToPc>());
    pc.message({ type: "event", event: { kind: "done", text: "fini" } });
    pc.close();
    expect(phone.got).toEqual([
      { type: "pc", connected: false },
      { type: "pc", connected: true },
      { type: "agent", event: { kind: "done", text: "fini" } },
      { type: "pc", connected: false },
    ]);
  });
  it("transmet l'annulation", () => {
    const relay = fakeRelay();
    const pc = peer<ToPc>();
    relay.attachPc("aaaaaaaaaa", pc);
    relay.attachPhone("aaaaaaaaaa", peer<ToPhone>()).message({ type: "cancel" });
    expect(pc.got).toEqual([{ type: "cancel" }]);
  });
});
