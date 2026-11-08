// Fichier généré par la pipeline Studio. Ne pas modifier à la main.
import type { Entry } from "../types";
import { Holoremote } from "./Holoremote";
import { Scene as S01 } from "./scenes/s01/Scene";
import { Scene as S02 } from "./scenes/s02/Scene";
import { Scene as S03 } from "./scenes/s03/Scene";
import { Scene as S04 } from "./scenes/s04/Scene";
import { Scene as S05 } from "./scenes/s05/Scene";
import { Scene as S06 } from "./scenes/s06/Scene";

export const entries: Entry[] = [
  { id: "Holoremote", component: Holoremote, durationInFrames: 1755 },
  { id: "Holoremote-s01", component: S01, durationInFrames: 300 },
  { id: "Holoremote-s02", component: S02, durationInFrames: 300 },
  { id: "Holoremote-s03", component: S03, durationInFrames: 300 },
  { id: "Holoremote-s04", component: S04, durationInFrames: 300 },
  { id: "Holoremote-s05", component: S05, durationInFrames: 300 },
  { id: "Holoremote-s06", component: S06, durationInFrames: 300 },
];
