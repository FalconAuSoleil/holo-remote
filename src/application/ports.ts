import type { Action } from "../domain/actions";

export interface Screenshot {
  pngBase64: string;
  width: number;
  height: number;
}

export interface ScreenPort {
  capture(): Promise<Screenshot>;
  screenSize(): Promise<{ width: number; height: number }>;
  // Image JPEG pour le partage d'écran en direct.
  captureJpeg(): Promise<Uint8Array<ArrayBuffer>>;
}

export interface InputPort {
  click(x: number, y: number, double?: boolean): Promise<void>;
  type(text: string): Promise<void>;
  key(keys: string): Promise<void>;
  scroll(x: number, y: number, dy: number): Promise<void>;
}

export type Part = { type: "text"; text: string } | { type: "image"; pngBase64: string };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | Part[] }
  | { role: "assistant"; content: string; toolCalls?: { id: string; name: string; arguments: string }[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ModelReply {
  content: string;
  toolCalls: { id: string; name: string; arguments: string }[];
}

export interface ModelPort {
  next(messages: ChatMessage[]): Promise<ModelReply>;
}

export interface SearchPort {
  search(query: string): Promise<string>;
}

export type { Action };
