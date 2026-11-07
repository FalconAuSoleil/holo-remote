import type { Connect } from "./gladia";

// Dans un Worker, un WebSocket sortant passe par fetch avec l'en-tête Upgrade.
export const workerConnect: Connect = async (url, h) => {
  const res = await fetch(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket;
  if (!ws) throw new Error(`Gladia : pas de WebSocket (${res.status})`);
  ws.accept();
  ws.addEventListener("message", (ev) => typeof ev.data === "string" && h.message(ev.data));
  ws.addEventListener("close", () => h.close());
  ws.addEventListener("error", () => h.error());
  return { send: (d) => ws.send(d), close: () => ws.close() };
};
