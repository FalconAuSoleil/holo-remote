// Lecture tolérante des événements de l'API Agents de H : le contrat détaillé des événements
// d'un bureau n'est pas entièrement documenté, donc on cherche les champs plausibles sans jamais planter.

export interface HEvent {
  type: string;
  data?: unknown;
  timestamp?: string;
}

export interface PendingToolCall {
  tool_name: string;
  args: Record<string, unknown>;
  id: string;
}

const obj = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

const TEXT_KEYS = ["thought", "reasoning", "message", "text", "summary", "description", "action"] as const;
const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function inner(ev: HEvent): Record<string, unknown> | undefined {
  const data = obj(ev.data);
  return obj(data?.data) ?? data;
}

// URL d'une capture d'écran d'observation (HTTPS seulement : c'est elle que le téléphone chargera).
export function frameUrl(ev: HEvent): string | null {
  const d = inner(ev);
  if (!d || (d.kind ?? d.type) === undefined) return null;
  const image = obj(d.image);
  const src = image?.source ?? image?.url;
  return typeof src === "string" && /^https:\/\//.test(src) ? src : null;
}

// Texte à montrer dans le chat pour une décision de l'agent.
export function describeStep(ev: HEvent): string | null {
  const d = inner(ev);
  if (!d || d.kind !== "policy_event") return null;
  for (const root of [d, obj(d.policy), obj(d.output)]) {
    if (!root) continue;
    for (const k of TEXT_KEYS) {
      const v = root[k];
      if (typeof v === "string" && v.trim()) return clip(v.trim());
      const nested = obj(v);
      if (nested) return clip(JSON.stringify(nested));
    }
    const actions = root.actions;
    if (Array.isArray(actions) && actions.length) return clip(actions.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(", "));
  }
  return null;
}

export function answerText(answer: unknown): string {
  if (answer == null) return "Terminé.";
  return typeof answer === "string" ? answer : clip(JSON.stringify(answer), 800);
}

export function toolCallsFrom(list: unknown): PendingToolCall[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((c) => {
    const o = obj(c);
    return o && typeof o.tool_name === "string" && typeof o.id === "string" ? [{ tool_name: o.tool_name, args: obj(o.args) ?? {}, id: o.id }] : [];
  });
}
