import { sendSchema } from "../src/domain/protocol.js";
import { SEARCH_TOOL } from "../src/infrastructure/h-api.js";
import { route } from "../src/infrastructure/vercel-http.js";

// Première instruction : crée la session H. Suivantes : message dans la même session.
export default route(async ({ h, body, search }) => {
  const q = sendSchema.parse(body);
  if (q.sessionId) {
    await h.sendMessage(q.sessionId, q.text);
    return { sessionId: q.sessionId };
  }
  const created = await h.createSession({ bridgeId: q.bridge, text: q.text, tools: search ? [SEARCH_TOOL] : [] });
  return { sessionId: created.id, viewUrl: created.viewUrl };
});
