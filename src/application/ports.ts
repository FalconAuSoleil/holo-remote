import type { FrameImage, HEvent, PendingToolCall } from "../domain/h-events.js";

export interface Changes {
  status: string; // running | completed | failed | timed_out | interrupted
  error?: string | null;
  answer?: unknown;
  outcome?: string | null; // success | partial | infeasible | blocked
  new_events?: HEvent[];
  first_index?: number | null;
  pending_tool_calls?: unknown;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  input_schema: object;
}

// API Agents de H (cloud) qui pilote le bureau de l'utilisateur par le pont `holo local desktop`.
export interface HPort {
  // Lève une HError 401/403 si la clé est refusée ; toute autre réponse compte comme valide.
  ping(): Promise<void>;
  createSession(input: { bridgeId: string; text: string; tools: ToolDeclaration[] }): Promise<{ id: string; viewUrl?: string }>;
  sendMessage(sessionId: string, text: string): Promise<void>;
  // null : aucun changement pendant l'attente.
  changes(sessionId: string, fromIndex: number, waitSeconds: number): Promise<Changes | null>;
  toolResult(sessionId: string, call: PendingToolCall, outcome: { result: string } | { error: string }): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  // Récupère les octets d'une capture : la plateforme peut exiger la clé, que le navigateur du téléphone ne peut pas envoyer.
  image(frame: FrameImage): Promise<Uint8Array<ArrayBuffer> | null>;
}

export interface SearchPort {
  search(query: string): Promise<string>;
}
