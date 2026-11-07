import { z } from "zod";

export const actionSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ name: z.literal("double_click"), x: z.number(), y: z.number() }),
  z.object({ name: z.literal("type"), text: z.string().max(2000) }),
  z.object({ name: z.literal("key"), keys: z.string().max(60) }),
  z.object({ name: z.literal("scroll"), x: z.number(), y: z.number(), dy: z.number() }),
  z.object({ name: z.literal("wait"), ms: z.number().min(0).max(5000) }),
  z.object({ name: z.literal("search"), query: z.string().min(2).max(500) }),
  z.object({ name: z.literal("done"), summary: z.string().max(2000) }),
]);
export type Action = z.infer<typeof actionSchema>;

// Description des outils au format OpenAI (le serveur Holo local les expose tels quels).
const num = { type: "number" } as const;
const str = { type: "string" } as const;
const tool = (name: string, description: string, properties: Record<string, object>) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required: Object.keys(properties) } },
});
export const TOOLS = [
  tool("click", "Clic gauche aux coordonnées en pixels de la capture.", { x: num, y: num }),
  tool("double_click", "Double clic aux coordonnées en pixels de la capture.", { x: num, y: num }),
  tool("type", "Saisit du texte dans le champ actif.", { text: str }),
  tool("key", "Appuie sur une touche ou un raccourci, par exemple Enter ou ctrl+l.", { keys: str }),
  tool("scroll", "Fait défiler à partir d'un point ; dy positif vers le bas.", { x: num, y: num, dy: num }),
  tool("wait", "Attend que l'écran se mette à jour (millisecondes, 5000 au plus).", { ms: num }),
  tool("search", "Recherche approfondie sur le web (Linkup) : pour toute question de connaissance, pas pour naviguer.", { query: str }),
  tool("done", "Termine : la tâche est faite ou impossible.", { summary: str }),
];

export function parseToolCall(name: string, rawArgs: string): Action | null {
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return null;
  }
  if (typeof args !== "object" || args === null) return null;
  const parsed = actionSchema.safeParse({ ...args, name });
  return parsed.success ? parsed.data : null;
}

// Repli pour un modèle sans appel d'outils : actions en texte, par exemple `click(120, 340)` ou `type("bonjour")`.
export function parseTextAction(content: string): Action | null {
  const m = /\b(click|double_click|type|key|scroll|wait|search|done)\s*\(([^)]*)\)/i.exec(content);
  if (!m) return null;
  const name = m[1]!.toLowerCase();
  const raw = m[2]!.trim();
  const nums = raw.split(",").map((s) => Number(s.trim()));
  const text = raw.replace(/^["'`]|["'`]$/g, "");
  const candidate =
    name === "click" || name === "double_click" ? { name, x: nums[0], y: nums[1] }
    : name === "scroll" ? { name, x: nums[0], y: nums[1], dy: nums[2] }
    : name === "wait" ? { name, ms: nums[0] }
    : name === "type" ? { name, text }
    : name === "key" ? { name, keys: text }
    : name === "search" ? { name, query: text }
    : { name, summary: text };
  const parsed = actionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

// La capture envoyée au modèle peut être réduite : on remet les coordonnées à l'échelle de l'écran.
export function scalePoint(
  p: { x: number; y: number },
  shot: { width: number; height: number },
  screen: { width: number; height: number },
): { x: number; y: number } {
  const clamp = (v: number, max: number) => Math.min(Math.max(Math.round(v), 0), max - 1);
  return {
    x: clamp((p.x * screen.width) / shot.width, screen.width),
    y: clamp((p.y * screen.height) / shot.height, screen.height),
  };
}
