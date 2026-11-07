# Pilote

Control your PC from your phone with your voice.

Open the site on your phone, enter the session code shown on your PC, hold the button and speak. Gladia transcribes, a local Holo model clicks and types on your PC, and Linkup handles the heavy web research as a tool.

## Run

1. `cp .env.example .env` and fill `GLADIA_API_KEY`, `LINKUP_API_KEY`, `RELAY_TOKEN`.
2. Serve Holo locally behind an OpenAI-compatible API with tool calling (vLLM: `--enable-auto-tool-choice`), then set `HOLO_BASE_URL` and `HOLO_MODEL`.
3. `pnpm server`, and expose its port over HTTPS (the phone microphone requires it), for example with Tailscale serve.
4. On the PC (not inside WSL): `pnpm agent`. It prints a session code.
5. Open the relay URL on your phone, enter the code.

## Safety

The session code and `RELAY_TOKEN` are the only access control: keep both private. The agent is told never to pay, send or delete unless asked, but it is a model: watch the screen on first runs.
