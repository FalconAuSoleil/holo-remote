import { frameSchema } from "../src/domain/protocol.js";
import { route } from "../src/infrastructure/vercel-http.js";

// Capture d'écran de l'agent : H la sert derrière la clé, que le navigateur ne peut pas joindre à une balise image.
export default route(async ({ h, body }) => {
  const frame = frameSchema.parse(body);
  if (!/^(https:\/\/|\/)/.test(frame.source)) throw new Error("Capture refusée.");
  const bytes = await h.image(frame);
  if (!bytes) return new Response(null, { status: 204 });
  return new Response(bytes, { headers: { "content-type": frame.mediaType ?? "image/jpeg", "cache-control": "no-store" } });
});
