import type { SearchPort } from "../application/ports.js";

interface LinkupResponse {
  answer?: string;
  sources?: { name?: string; url?: string; snippet?: string }[];
}

// Recherche approfondie Linkup, exposée à Holo comme un outil.
export function linkupSearch(apiKey: string, fetchImpl: typeof fetch = fetch): SearchPort {
  return {
    async search(query) {
      const res = await fetchImpl("https://api.linkup.so/v1/search", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ q: query, depth: "deep", outputType: "sourcedAnswer" }),
      });
      if (!res.ok) throw new Error(`Linkup ${res.status}`);
      const data = (await res.json()) as LinkupResponse;
      const sources = (data.sources ?? []).slice(0, 5).map((s) => `- ${s.name ?? ""} ${s.url ?? ""}`.trim());
      return [data.answer ?? "Aucune réponse.", ...(sources.length ? ["Sources :", ...sources] : [])].join("\n");
    },
  };
}
