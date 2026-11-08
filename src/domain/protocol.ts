import { z } from "zod";

// Identifiant du pont de bureau (affiché par `holo local desktop`) : un UUID passe.
export const SESSION_RE = /^[a-zA-Z0-9-]{8,64}$/;
const SESSION_ID = z.string().regex(/^[\w-]{1,128}$/);

export type AgentEvent = {
  kind: "start" | "step" | "search" | "done" | "error" | "cancelled";
  text: string;
};

// Corps des requêtes du navigateur vers /api. La clé H voyage dans l'en-tête x-h-key, jamais dans le corps.
export const sendSchema = z.object({
  bridge: z.string().regex(SESSION_RE),
  text: z.string().trim().min(1).max(2000),
  sessionId: SESSION_ID.optional(), // absent : première instruction, on crée la session
});
export const pollSchema = z.object({
  sessionId: SESSION_ID,
  from: z.number().int().min(0),
  handled: z.array(z.string().max(200)).max(200).default([]), // appels d'outils déjà traités
});
export const cancelSchema = z.object({ sessionId: SESSION_ID });
export const frameSchema = z.object({ type: z.literal("url"), source: z.string().min(1).max(4000), mediaType: z.string().optional() });
