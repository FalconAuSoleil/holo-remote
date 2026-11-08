import { VOCABULARY } from "../src/domain/vocabulary.js";
import { gladiaLiveUrl } from "../src/infrastructure/gladia.js";
import { route } from "../src/infrastructure/vercel-http.js";

// Ouvre une transcription Gladia : le navigateur s'y connecte directement. Réservé aux porteurs d'une clé H valide.
export default route(async ({ h }) => {
  await h.ping();
  const apiKey = process.env.GLADIA_API_KEY;
  if (!apiKey) throw new Error("Transcription non configurée (GLADIA_API_KEY).");
  return { url: await gladiaLiveUrl({ apiKey, language: process.env.GLADIA_LANGUAGE || "fr", vocabulary: VOCABULARY }) };
});
