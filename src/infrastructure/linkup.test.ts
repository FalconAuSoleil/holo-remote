import { expect, it } from "vitest";
import { linkupSearch } from "./linkup.js";

it("appelle Linkup en recherche approfondie et formate les sources", async () => {
  let body: any;
  const fake = (async (_u: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return Response.json({ answer: "42", sources: [{ name: "A", url: "https://a.test" }] });
  }) as unknown as typeof fetch;
  const out = await linkupSearch("k", fake).search("question");
  expect(body).toMatchObject({ q: "question", depth: "deep", outputType: "sourcedAnswer" });
  expect(out).toBe("42\nSources :\n- A https://a.test");
});
