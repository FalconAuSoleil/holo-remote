import type { ChatMessage, ModelPort, ModelReply } from "../application/ports";
import { TOOLS } from "../domain/actions";

interface HoloOptions {
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
}

function toWire(m: ChatMessage): object {
  switch (m.role) {
    case "user":
      return {
        role: "user",
        content:
          typeof m.content === "string"
            ? m.content
            : m.content.map((p) =>
                p.type === "text"
                  ? { type: "text", text: p.text }
                  : { type: "image_url", image_url: { url: `data:image/png;base64,${p.pngBase64}` } },
              ),
      };
    case "assistant":
      return {
        role: "assistant",
        content: m.content,
        ...(m.toolCalls?.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })) }
          : {}),
      };
    case "tool":
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    default:
      return m;
  }
}

// Holo servi en local derrière une API compatible OpenAI (vLLM, llama.cpp, Ollama).
export function holoModel(opts: HoloOptions): ModelPort {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async next(messages): Promise<ModelReply> {
      const res = await doFetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          messages: messages.map(toWire),
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });
      if (!res.ok) throw new Error(`Holo ${res.status} : ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        choices: { message: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      };
      const msg = data.choices[0]?.message;
      if (!msg) throw new Error("Holo : réponse vide");
      return {
        content: msg.content ?? "",
        toolCalls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
      };
    },
  };
}
