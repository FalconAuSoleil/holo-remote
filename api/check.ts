import { route } from "../src/infrastructure/vercel-http.js";

// Vérifie la clé H dès la connexion.
export default route(async ({ h }) => {
  await h.ping();
  return { ok: true };
});
