# HoloRemote

Control your PC from your phone with your voice.

Open the site on your phone, enter the session code printed by `holo local desktop` and your H API key, tap the bubble and speak. Gladia transcribes, H's cloud agent clicks and types on your PC through the desktop bridge, and you watch its screen live.

## Use

1. On the PC you want to control: `pip install holo-desktop-cli`, then `holo local desktop`. It prints a session code.
2. Open https://holoremote.vercel.app on your phone.
3. Enter the session code and your H API key (`HAI_API_KEY`). The key stays in your browser; the server uses it for each request and never stores it.

## Built with

- **H Agents API**: the cloud agent API. Each instruction opens an agent session that plans the task and sends its actions to your PC.
- **Holo, a local model**: H's Holo model, running on your PC through the `holo local desktop` bridge. It looks at the screen and carries out the clicks and typing.
- **Gladia**: live speech-to-text. The page opens a Gladia WebSocket directly and streams the microphone to it; only final sentences are kept. The server hands out a short-lived session URL, so the Gladia key never reaches the browser.
- **Linkup**: web research. It is exposed to the agent as a tool, so it can look things up online while it works on your PC.

## Safety

Whoever has your session code and key can drive your PC: keep both private. The agent is told never to pay, send or delete unless asked, but it is a model: watch the screen on first runs.
