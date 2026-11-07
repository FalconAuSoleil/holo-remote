import type { HEvent, PendingToolCall } from "../domain/h-events";

export interface Changes {
  status: string; // running | completed | failed | timed_out | interrupted
  error?: string | null;
  answer?: unknown;
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
  createSession(input: { bridgeId: string; text: string; tools: ToolDeclaration[] }): Promise<string>;
  sendMessage(sessionId: string, text: string): Promise<void>;
  // null : aucun changement pendant l'attente.
  changes(sessionId: string, fromIndex: number, waitSeconds: number): Promise<Changes | null>;
  toolResult(sessionId: string, call: PendingToolCall, outcome: { result: string } | { error: string }): Promise<void>;
  cancel(sessionId: string): Promise<void>;
}

export interface SearchPort {
  search(query: string): Promise<string>;
}
