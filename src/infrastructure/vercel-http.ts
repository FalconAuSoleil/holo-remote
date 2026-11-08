import { ZodError } from "zod";
import { friendly } from "../application/relay.js";
import type { HPort, SearchPort } from "../application/ports.js";
import { hApi } from "./h-api.js";
import { linkupSearch } from "./linkup.js";

export interface Ctx {
  h: HPort;
  body: unknown;
  search?: SearchPort; // sans clé Linkup, l'outil de recherche n'est pas proposé à l'agent
}

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

// Enveloppe d'une route /api : POST seulement, même origine, clé H dans x-h-key (jamais stockée ni journalisée),
// erreurs de H traduites en messages lisibles.
export function route(run: (c: Ctx) => Promise<unknown>): { fetch(req: Request): Promise<Response> } {
  return {
    async fetch(req) {
      if (req.method !== "POST") return json({ error: "POST attendu." }, 405);
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: "Origine refusée." }, 403);
      const key = req.headers.get("x-h-key")?.trim() ?? "";
      if (key.length < 8 || key.length > 400) return json({ error: "Clé H manquante ou invalide." }, 401);
      let body: unknown = {};
      try {
        body = await req.json();
      } catch {
        /* corps vide */
      }
      const linkup = process.env.LINKUP_API_KEY;
      try {
        const out = await run({
          h: hApi({ apiKey: key, baseUrl: process.env.H_API_BASE || undefined }),
          body,
          search: linkup ? linkupSearch(linkup) : undefined,
        });
        return out instanceof Response ? out : json(out);
      } catch (err) {
        if (err instanceof ZodError) return json({ error: "Requête invalide." }, 400);
        return json({ error: friendly(err) }, 502);
      }
    },
  };
}
