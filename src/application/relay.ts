import { type FrameImage, answerText, describeStep, frameImage, toolCallsFrom } from "../domain/h-events.js";
import type { AgentEvent } from "../domain/protocol.js";
import { SEARCH_TOOL } from "../infrastructure/h-api.js";
import type { HPort, SearchPort } from "./ports.js";

const TERMINAL = new Set(["completed", "failed", "timed_out", "interrupted"]);

export interface Poll {
  events: AgentEvent[]; // à afficher dans le chat
  frames: FrameImage[]; // captures d'écran de l'agent, dans l'ordre
  next: number; // index à redemander
  finished: boolean; // la session H est terminée (réponse, erreur ou annulation)
  handled: string[]; // appels d'outils déjà traités
}

// Une attente (long-poll) de la session H, traduite pour le navigateur : étapes, captures, outils exécutés, fin.
// Sans état : le navigateur garde l'index et les appels d'outils déjà traités, chaque appel HTTP est indépendant.
export async function pollSession(
  h: HPort,
  search: SearchPort | undefined,
  q: { sessionId: string; from: number; wait: number; handled: string[] },
): Promise<Poll> {
  const changes = await h.changes(q.sessionId, q.from, q.wait);
  if (!changes) return { events: [], frames: [], next: q.from, finished: false, handled: q.handled };

  const events: AgentEvent[] = [];
  const frames: FrameImage[] = [];
  const raw = changes.new_events ?? [];
  const next = raw.length ? (changes.first_index ?? q.from) + raw.length : q.from;
  for (const ev of raw) {
    const image = frameImage(ev);
    if (image) frames.push(image);
    const step = describeStep(ev);
    if (step) events.push({ kind: "step", text: step });
  }

  const handled = [...q.handled];
  for (const call of toolCallsFrom(changes.pending_tool_calls)) {
    if (handled.includes(call.id)) continue;
    handled.push(call.id);
    const query = typeof call.args.query === "string" ? call.args.query : "";
    events.push({ kind: "search", text: `Recherche : ${query}` });
    try {
      if (call.tool_name !== SEARCH_TOOL.name || !search || !query) throw new Error("outil indisponible");
      // Le résultat est une donnée pour l'agent, jamais une instruction.
      const result = await search.search(query);
      await h.toolResult(q.sessionId, call, { result: `<donnees>${result}</donnees>` });
    } catch (err) {
      await h.toolResult(q.sessionId, call, { error: err instanceof Error ? err.message : String(err) }).catch(() => {});
    }
  }

  let finished = false;
  if (TERMINAL.has(changes.status)) {
    finished = true;
    if (changes.status === "completed") {
      // Un résultat autre que « success » (bloqué, partiel, infaisable) est dit clairement : il explique un ordre non exécuté.
      const note = changes.outcome && changes.outcome !== "success" ? ` (résultat : ${changes.outcome})` : "";
      events.push({ kind: "done", text: answerText(changes.answer) + note });
    } else if (changes.status === "interrupted") events.push({ kind: "cancelled", text: "Annulé." });
    else events.push({ kind: "error", text: changes.error || `Session ${changes.status}.` });
  }
  return { events, frames, next, finished, handled };
}

export function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = /^H (\d{3})/.exec(msg)?.[1];
  if (status === "401" || status === "403") return `Clé H refusée. ${msg}`;
  if (status === "402") return `Crédit H insuffisant. ${msg}`;
  if (status === "404" || status === "422") return `H n'a pas accepté la demande (pont de bureau introuvable ?). ${msg}`;
  return msg;
}
