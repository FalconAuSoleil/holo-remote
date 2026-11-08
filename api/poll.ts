import { pollSession } from "../src/application/relay.js";
import { pollSchema } from "../src/domain/protocol.js";
import { route } from "../src/infrastructure/vercel-http.js";

// Attend jusqu'à 20 s un changement de la session H (étapes, captures, outils, fin).
export default route(async ({ h, body, search }) => {
  const q = pollSchema.parse(body);
  return pollSession(h, search, { ...q, wait: 20 });
});
