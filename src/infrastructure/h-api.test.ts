import { expect, it } from "vitest";
import { HError, hApi } from "./h-api";

function recorder(res: () => Response) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => (seen.push({ url, init }), res())) as unknown as typeof fetch;
  return { seen, fetchImpl };
}

it("crée une session avec l'environnement bureau et l'identifiant du pont", async () => {
  const r = recorder(() => Response.json({ id: "abc" }, { status: 201 }));
  const id = await hApi({ apiKey: "K", fetchImpl: r.fetchImpl }).createSession({ bridgeId: "pont-12345678", text: "ouvre", tools: [] });
  const body = JSON.parse(String(r.seen[0]!.init.body));
  expect(id).toBe("abc");
  expect(r.seen[0]!.url).toBe("https://agp.eu.hcompany.ai/api/v2/sessions");
  expect((r.seen[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer K");
  expect(body.agent.environments[0]).toMatchObject({ kind: "desktop", session_id: "pont-12345678" });
  expect(body.messages).toBe("ouvre");
});

it("lit le long-poll, y compris l'absence de changement", async () => {
  const none = recorder(() => new Response(null, { status: 204 }));
  expect(await hApi({ apiKey: "K", fetchImpl: none.fetchImpl }).changes("s", 3, 20)).toBeNull();
  expect(none.seen[0]!.url).toContain("/sessions/s/changes?from_index=3&wait_for_seconds=20");
  const some = recorder(() => Response.json({ status: "running" }));
  expect(await hApi({ apiKey: "K", fetchImpl: some.fetchImpl }).changes("s", 0, 0)).toEqual({ status: "running" });
});

it("renvoie une erreur lisible avec le statut HTTP", async () => {
  const r = recorder(() => new Response("bad key", { status: 401 }));
  await expect(hApi({ apiKey: "K", fetchImpl: r.fetchImpl }).sendMessage("s", "x")).rejects.toBeInstanceOf(HError);
  await expect(hApi({ apiKey: "K", fetchImpl: r.fetchImpl }).cancel("s")).rejects.toThrow("H 401");
});

it("renvoie un résultat d'outil ou une erreur d'outil", async () => {
  const r = recorder(() => new Response(null, { status: 200 }));
  const h = hApi({ apiKey: "K", fetchImpl: r.fetchImpl });
  const call = { tool_name: "web_research", args: { query: "q" }, id: "c1" };
  await h.toolResult("s", call, { result: "ok" });
  await h.toolResult("s", call, { error: "boom" });
  expect(JSON.parse(String(r.seen[0]!.init.body))).toMatchObject({ kind: "tool_result", result: "ok", tool_req: { id: "c1" } });
  expect(JSON.parse(String(r.seen[1]!.init.body))).toMatchObject({ kind: "error_event", origin: "custom_tools" });
});
