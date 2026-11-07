import { z } from "zod";

// Identifiant du pont de bureau (affiché par `holo local desktop`) : un UUID passe.
export const SESSION_RE = /^[a-zA-Z0-9-]{8,64}$/;
export const ROOM_RE = /^[a-f0-9]{64}$/;

export const phoneMessageSchema = z.discriminatedUnion("type", [
  // Le serveur ne stocke jamais la clé : elle reste en mémoire de la session le temps de la connexion.
  z.object({ type: z.literal("hello"), session: z.string().regex(SESSION_RE), key: z.string().trim().min(8).max(400) }),
  z.object({ type: z.literal("voice-start") }),
  z.object({ type: z.literal("voice-end") }),
  z.object({ type: z.literal("voice-cancel") }),
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("cancel") }),
]);
export type PhoneMessage = z.infer<typeof phoneMessageSchema>;

export type AgentEvent = {
  kind: "start" | "step" | "search" | "done" | "error" | "cancelled";
  text: string;
};

// Ce que le serveur envoie au téléphone.
export type ToPhone =
  | { type: "ready" }
  | { type: "listening" } // la transcription est prête : l'utilisateur peut parler
  | { type: "partial"; text: string }
  | { type: "transcript"; text: string }
  | { type: "agent"; event: AgentEvent }
  | { type: "session"; url: string } // page de suivi de la session chez H
  | { type: "error"; text: string };

// La pièce est le hachage de « pilote-v2:pont:clé » (changer le préfixe envoie tout le monde sur de nouvelles instances, avec le code à jour) : sans les deux, impossible de rejoindre la session d'un autre.
export async function roomId(session: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pilote-v2:${session}:${key}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
