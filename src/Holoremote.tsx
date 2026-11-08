// Fichier généré par la pipeline Studio. Ne pas modifier à la main.
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Audio, staticFile } from "remotion";
import { Scene as S01 } from "./scenes/s01/Scene";
import { Scene as S02 } from "./scenes/s02/Scene";
import { Scene as S03 } from "./scenes/s03/Scene";
import { Scene as S04 } from "./scenes/s04/Scene";
import { Scene as S05 } from "./scenes/s05/Scene";
import { Scene as S06 } from "./scenes/s06/Scene";

// Ordre du deck, une séquence par slide.
export const Holoremote = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={300}>
      <S01 />
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={300}>
      <S02 />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence durationInFrames={300}>
      <S03 />
    </TransitionSeries.Sequence>
    <TransitionSeries.Sequence durationInFrames={300}>
      <S04 />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence durationInFrames={300}>
      <S05 />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence durationInFrames={300}>
      <S06 />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
