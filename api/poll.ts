import { pollSession } from "../src/application/relay.js";
import { pollSchema } from "../src/domain/protocol.js";
import { route } from "../src/infrastructure/vercel-http.js";

// Attend jusqu'à 20 s un changement de la session H (étapes, captures, outils, fin).
export default route(async ({ h, body, search }) => {
  const q = pollSchema.parse(body);
  const out = await pollSession(h, search, { ...q, wait: 20 });
  // Journal de diagnostic : jamais la clé ni le texte de l'agent.
  console.log(`poll ${q.sessionId.slice(0, 8)} statut=${out.status ?? "aucun changement"} événements=${out.events.length} captures=${out.frames.length}`);
  return out;
});
