import { Relay } from "./application/relay";
import { gladiaTranscriber } from "./infrastructure/gladia";
import { startHttp } from "./infrastructure/http";

const list = (v?: string) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
const gladiaKey = process.env.GLADIA_API_KEY;
if (!gladiaKey) {
  console.error("Variable manquante : GLADIA_API_KEY (voir .env.example)");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3200);
const pcToken = process.env.RELAY_TOKEN || undefined;
// Relais public (pas de jeton) : quotas de voix et de sessions, sinon la clé Gladia est à la merci de tous.
const limits = pcToken
  ? undefined
  : {
      maxRecordingMs: 30_000,
      sessionVoiceBudgetMs: Number(process.env.SESSION_VOICE_BUDGET_S ?? 600) * 1000,
      maxSessions: Number(process.env.MAX_SESSIONS ?? 300),
    };
const relay = new Relay(gladiaTranscriber({ apiKey: gladiaKey, language: process.env.GLADIA_LANGUAGE ?? "fr" }), limits);
startHttp({
  relay,
  pcToken,
  port,
  allowedOrigins: list(process.env.ALLOWED_ORIGINS),
  trustProxy: process.env.TRUST_PROXY === "1",
});
console.log(`Relais ${pcToken ? "privé" : "PUBLIC"} sur http://0.0.0.0:${port}`);
