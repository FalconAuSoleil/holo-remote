import { type AgentDeps, runAgent } from "./application/agent-loop";
import { type ToPc, newSessionId, SESSION_RE } from "./domain/protocol";
import { desktopInput, desktopScreen } from "./infrastructure/desktop";
import { holoModel } from "./infrastructure/holo";
import { linkupSearch } from "./infrastructure/linkup";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Variable manquante : ${name} (voir .env.example)`);
    process.exit(1);
  }
  return v;
}

const session = process.env.SESSION_ID ?? newSessionId();
if (!SESSION_RE.test(session)) {
  console.error("SESSION_ID doit faire 10 caractères a-z0-9.");
  process.exit(1);
}
const relayUrl = process.env.RELAY_URL ?? "ws://127.0.0.1:3200";
const token = process.env.RELAY_TOKEN; // facultatif : absent pour le relais public

const deps: AgentDeps = {
  screen: desktopScreen(),
  input: desktopInput(),
  model: holoModel({
    baseUrl: process.env.HOLO_BASE_URL ?? "http://127.0.0.1:8000/v1",
    model: process.env.HOLO_MODEL ?? "Hcompany/Holo1.5-7B",
  }),
  search: linkupSearch(need("LINKUP_API_KEY")),
  maxSteps: Number(process.env.MAX_STEPS ?? 30),
};

let current: AbortController | undefined;
let running = false;
let lastActive = 0;
let pumping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Partage d'écran : des images JPEG tant que l'agent travaille, puis encore 3 s.
async function pumpFrames(ws: WebSocket) {
  if (pumping) return;
  pumping = true;
  try {
    while (ws.readyState === WebSocket.OPEN && (running || Date.now() - lastActive < 3000)) {
      ws.send(await deps.screen.captureJpeg());
      await sleep(500);
    }
  } catch (err) {
    console.error("Partage d'écran interrompu :", err);
  }
  pumping = false;
}

function connect() {
  const ws = new WebSocket(`${relayUrl}/ws?role=pc&session=${session}${token ? `&token=${encodeURIComponent(token)}` : ""}`);
  const send = (event: { kind: string; text: string }) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "event", event }));
  ws.onopen = () => console.log(`Session ${session} : ouvre le site sur ton téléphone et saisis ce code.`);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data)) as ToPc;
    if (msg.type === "cancel") return current?.abort();
    current?.abort(); // une nouvelle instruction remplace la précédente
    const ctl = (current = new AbortController());
    running = true;
    lastActive = Date.now();
    void pumpFrames(ws);
    runAgent(deps, msg.text, ctl.signal, (e) => {
      console.log(`[${e.kind}] ${e.text}`);
      send(e);
    })
      .catch((err) => send({ kind: "error", text: String(err) }))
      .finally(() => {
        if (current === ctl) running = false;
        lastActive = Date.now();
      });
  };
  ws.onclose = () => {
    current?.abort();
    setTimeout(connect, 3000);
  };
  ws.onerror = () => {};
}
connect();
