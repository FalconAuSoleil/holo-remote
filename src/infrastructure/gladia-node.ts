import type { Connect } from "./gladia";

export const nodeConnect: Connect = (url, h) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => resolve({ send: (d) => ws.send(d), close: () => ws.close() });
    ws.onmessage = (ev) => typeof ev.data === "string" && h.message(ev.data);
    ws.onclose = () => h.close();
    ws.onerror = () => {
      h.error();
      reject(new Error("connexion Gladia impossible"));
    };
  });
