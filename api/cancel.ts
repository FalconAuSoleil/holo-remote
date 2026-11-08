import { cancelSchema } from "../src/domain/protocol.js";
import { route } from "../src/infrastructure/vercel-http.js";

export default route(async ({ h, body }) => {
  await h.cancel(cancelSchema.parse(body).sessionId);
  return { ok: true };
});
