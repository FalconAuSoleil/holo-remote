import { z } from "zod";

// 10 caractères base36 : environ 51 bits, assez pour un secret partagé de courte durée.
export const SESSION_RE = /^[a-z0-9]{10}$/;

export function newSessionId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(10), (b) => (b % 36).toString(36)).join("");
}

export const agentEventSchema = z.object({
  kind: z.enum(["start", "step", "search", "done", "error", "cancelled"]),
  text: z.string().max(4000),
});
export type AgentEvent = z.infer<typeof agentEventSchema>;

export const phoneMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("voice-start") }),
  z.object({ type: z.literal("voice-end") }),
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("cancel") }),
]);
export type PhoneMessage = z.infer<typeof phoneMessageSchema>;

export const pcMessageSchema = z.object({ type: z.literal("event"), event: agentEventSchema });
export type PcMessage = z.infer<typeof pcMessageSchema>;

// Ce que le relais envoie au téléphone.
export type ToPhone =
  | { type: "pc"; connected: boolean }
  | { type: "partial"; text: string }
  | { type: "transcript"; text: string }
  | { type: "agent"; event: AgentEvent }
  | { type: "error"; text: string };

// Ce que le relais envoie au PC.
export type ToPc = { type: "instruction"; id: number; text: string } | { type: "cancel" };
