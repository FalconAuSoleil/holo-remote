import { Relay } from "./application/relay";
import { gladiaTranscriber } from "./infrastructure/gladia";
import { startHttp } from "./infrastructure/http";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Variable manquante : ${name} (voir .env.example)`);
    process.exit(1);
  }
  return v;
}

const port = Number(process.env.PORT ?? 3200);
const relay = new Relay(gladiaTranscriber({ apiKey: need("GLADIA_API_KEY"), language: process.env.GLADIA_LANGUAGE ?? "fr" }));
startHttp({ relay, pcToken: need("RELAY_TOKEN"), port });
console.log(`Relais sur http://0.0.0.0:${port}`);
console.log("Le micro du téléphone exige HTTPS : exposer ce port par un tunnel (Tailscale serve, cloudflared).");
