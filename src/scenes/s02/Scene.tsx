import { AudioLines, Check, Mic, Server, X } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp, formatFr, keyframes } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Palette du site HoloRemote : accent bleu unique, cartes ardoise, remplissages clairs.
const C = {
  bgTop: "#8692FF",
  bgBottom: "#D3DAFF",
  blue: "#3B82F6",
  slate: "#5660A7",
  light: "#DCE1FF",
  inactive: "#B7BEFF",
  arrow: "#FFFFFF",
  ink: "#FFFFFF",
  inkSoft: "#EEF0FF",
  // Teinte de Gladia et de ce qu'elle émet (accent indigo de la charte).
  gladia: theme.accent,
};

// Courbes de la bible.
const easeInOutCubic = Easing.inOut(Easing.cubic);
const easeOutCubic = Easing.out(Easing.cubic);
const easeInCubic = Easing.in(Easing.cubic);
const easeInOutSine = Easing.inOut(Easing.sin);
const easeOutBack = Easing.out(Easing.back(1.7));
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Monde : axe du flux à y = 540.
const AXIS = 540;
const MIC_X = 960;
const MIC_R = 165;
const WAVE_X0 = MIC_X + MIC_R;
const WORKER = { x: 3400, w: 360, h: 260 };
const GLADIA = { x: 4200, w: 480, h: 320 };
const WAVE_X1 = GLADIA.x - GLADIA.w / 2;
const RING = { x: 5100, r: 280 };
const PACKET = { w: 470, h: 130, x1: 6000 };
const FLY_ARROW_END = 6500;

// Horaire.
const T = {
  morph: 4,
  kicker: 6,
  title: 12,
  mic: 14,
  wave: 18,
  headerOut: 40,
  khz: 52,
  micLabel: 26,
  khzLabel: 60,
  worker: 104,
  workerHit: 125,
  gladia: 140,
  gladiaHit: 160,
  outArrow: 164,
  ringIn: 180,
  words: 186,
  ringEmpty: 193,
  sec: 204,
  secLabel: 216,
  button: 226,
  buttonPulse: 238,
  collapse: 268,
  fly: 274,
  check: 280,
  hudOut: 276,
};

const headX = (f: number) =>
  interpolate(f, [T.wave, T.workerHit, T.gladiaHit], [WAVE_X0, WORKER.x - WORKER.w / 2, WAVE_X1], clamp);
const packetX = (f: number) =>
  interpolate(f, [T.fly, T.fly + 22], [RING.x, PACKET.x1], { ...clamp, easing: easeInOutSine });

const zoomAt = (f: number) =>
  keyframes(
    f,
    [[0, 1], [45, 1.3], [90, 1], [140, 1], [175, 1.08], [190, 1.08], [230, 1.15], [268, 1.19], [298, 1.06]],
    easeInOutCubic,
  );
const camYAt = (f: number) => keyframes(f, [[0, 540], [190, 540], [230, 488]], easeInOutCubic);

const pulse = (f: number, start: number) =>
  f < start || f > start + 30 ? 1 : 1 + 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (f - start)) / 30));

const pop = (f: number, start: number) => ({
  opacity: interpolate(f, [start, start + 15], [0, 1], { ...clamp, easing: easeOutCubic }),
  scale: interpolate(f, [start, start + 15], [0.85, 1], { ...clamp, easing: easeOutBack }),
});

// Onde vocale : une seule ligne bleue, phase qui défile avec la frame.
const wavePath = (f: number, head: number) => {
  const end = Math.min(head, WAVE_X1);
  if (end <= WAVE_X0 + 4) return "";
  let d = "";
  for (let x = WAVE_X0; x <= end; x += 6) {
    const taperIn = Math.min(1, (x - WAVE_X0) / 80);
    const taperHead = head < WAVE_X1 ? Math.min(1, (end - x) / 120) : 1;
    const env = 100 * (0.45 + 0.55 * Math.abs(Math.sin(x / 230 + 0.7))) * taperIn * taperHead;
    const y = AXIS + env * Math.sin((x - f * 18) / 26);
    d += `${d ? " L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

// Texte mot par mot : 3 frames de décalage, montée de 16 px, fondu en 12 frames.
const Words = ({
  text,
  start,
  frame,
  style,
  stagger = 3,
  dx = 0,
}: {
  text: string;
  start: number;
  frame: number;
  style?: React.CSSProperties;
  stagger?: number;
  dx?: number;
}) => (
  <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", ...style }}>
    {text.split(" ").map((w, i) => {
      const s = start + i * stagger;
      const p = interpolate(frame, [s, s + 12], [0, 1], { ...clamp, easing: easeOutCubic });
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: p,
            transform: `translate(${(1 - p) * dx}px, ${(1 - p) * 16}px)`,
          }}
        >
          {w}
        </span>
      );
    })}
  </div>
);

type BoxProps = {
  x: number;
  w: number;
  h: number;
  stroke: string;
  start: number;
  frame: number;
  scale?: number;
  fill?: string;
  children: React.ReactNode;
};

// Case ardoise très arrondie, contour 4 px.
const Box = ({ x, w, h, stroke, start, frame, scale = 1, fill = C.slate, children }: BoxProps) => {
  const p = pop(frame, start);
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: AXIS - h / 2,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 48,
        backgroundColor: fill,
        border: `4px solid ${stroke}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: p.opacity,
        transform: `scale(${p.scale * scale})`,
      }}
    >
      {children}
    </div>
  );
};

// Libellé en pastille ardoise : le texte blanc reste lisible sur le fond clair.
const Label = ({ x, top, text, start, frame }: { x: number; top: number; text: string; start: number; frame: number }) => {
  const p = pop(frame, start);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 400,
        top,
        width: 800,
        display: "flex",
        justifyContent: "center",
        opacity: p.opacity,
        transform: `scale(${p.scale})`,
      }}
    >
      <div
        style={{
          padding: "10px 34px",
          borderRadius: 999,
          backgroundColor: C.slate,
          fontSize: 48,
          fontWeight: 500,
          color: C.ink,
          lineHeight: 1.2,
        }}
      >
        <Words text={text} start={start + 2} frame={frame} />
      </div>
    </div>
  );
};

const Arrow = ({ x1, x2, p }: { x1: number; x2: number; p: number }) => {
  if (p <= 0) return null;
  const tip = x1 + (x2 - x1) * p;
  const head = interpolate(p, [0.9, 1], [0, 1], clamp);
  return (
    <g>
      <line x1={x1} y1={AXIS} x2={tip - 10 * head} y2={AXIS} stroke={C.arrow} strokeWidth={6} strokeLinecap="round" />
      <polygon points={`${tip},${AXIS} ${tip - 20},${AXIS - 11} ${tip - 20},${AXIS + 11}`} fill={C.arrow} opacity={head} />
    </g>
  );
};

export const Scene = () => {
  const frame = useCurrentFrame();

  // --- Caméra virtuelle ---
  const zoom = zoomAt(frame);
  const plungeX = interpolate(frame, [0, 45], [960, 1060], { ...clamp, easing: easeInOutCubic });
  const followX = headX(frame - 6) - 390 / zoom;
  const w1 = interpolate(frame, [28, 58], [0, 1], { ...clamp, easing: easeInOutCubic });
  const w2 = interpolate(frame, [150, 215], [0, 1], { ...clamp, easing: easeInOutCubic });
  const RING_CAM_X = 5330;
  let camX = plungeX + (followX - plungeX) * w1;
  camX = camX + (RING_CAM_X - camX) * w2;
  // Panoramique qui suit le paquet en gardant la porte (l'anneau) dans le champ.
  if (frame >= T.collapse) camX = keyframes(frame, [[T.collapse, RING_CAM_X], [299, 5750]], easeInOutCubic);
  const camY = camYAt(frame);

  // --- Plan 1 : la case Gladia du raccord se resserre en pastille micro bleue ---
  const m = interpolate(frame, [T.morph, 30], [0, 1], { ...clamp, easing: easeInOutCubic });
  const morphW = interpolate(m, [0, 1], [1600, MIC_R * 2]);
  const morphH = interpolate(m, [0, 1], [800, MIC_R * 2]);
  const morphR = interpolate(m, [0, 1], [48, MIC_R]);
  const morphFill = interpolateColors(m, [0, 1], [C.slate, C.blue]);
  const audioOut = interpolate(frame, [T.morph, T.morph + 12], [0, 1], { ...clamp, easing: easeInCubic });
  const micIn = pop(frame, T.mic);
  const micPulse =
    frame >= T.wave && frame < 120 ? 1 + 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - T.wave)) / 30)) : 1;
  const headerOut = interpolate(frame, [T.headerOut, T.headerOut + 10], [1, 0], { ...clamp, easing: easeInCubic });

  // --- Plan 2 : onde et compteur 16 kHz ---
  const head = headX(frame);
  const wave = frame >= T.wave ? wavePath(frame, head) : "";
  const khzCard = pop(frame, T.khz);
  const khzOut = interpolate(frame, [140, 150], [1, 0], { ...clamp, easing: easeInCubic });
  const khzValue = 16 * easeOutExpo(interpolate(frame, [T.khz, T.khz + 24], [0, 1], clamp));

  // --- Plan 3 : Worker, Gladia, flèche de sortie ---
  const outArrow = interpolate(frame, [T.outArrow, T.outArrow + 22], [0, 1], { ...clamp, easing: easeInOutCubic });

  // --- Plan 4 : disque du texte et anneau de 2,5 s ---
  const ringPop = pop(frame, T.ringIn);
  const remaining = interpolate(frame, [T.ringEmpty, T.ringEmpty + 75], [1, 0], clamp);
  const collapse = interpolate(frame, [T.collapse, T.collapse + 8], [0, 1], { ...clamp, easing: easeInCubic });
  const ringScale = ringPop.scale;
  const diskFill = interpolateColors(frame, [T.fly, T.fly + 10], [C.gladia, C.slate]);
  const checkPop = pop(frame, T.check);
  const circ = 2 * Math.PI * RING.r;
  const secCard = pop(frame, T.sec);
  const hudOut = interpolate(frame, [T.hudOut, T.hudOut + 10], [1, 0], { ...clamp, easing: easeInCubic });
  const buttonPop = pop(frame, T.button);
  const buttonFill = interpolateColors(frame, [T.collapse, T.collapse + 8], [C.blue, C.inactive]);

  // --- Plan 5 : le texte validé part en paquet indigo ---
  const packetIn = interpolate(frame, [T.collapse, T.collapse + 10], [0, 1], { ...clamp, easing: easeOutBack });
  const px = packetX(frame);
  const flyArrow = interpolate(frame, [T.collapse + 2, T.collapse + 24], [0, 1], { ...clamp, easing: easeInOutCubic });

  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 72px 34px",
    borderRadius: 48,
    backgroundColor: C.slate,
  };

  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`, fontFamily: theme.font }}
    >
      {/* Compteur 2,5 s (valeur fixe) et bouton Annuler, sous la couche monde : le paquet passe devant */}
      {frame >= T.sec && hudOut > 0 && (
        <div
          style={{
            position: "absolute",
            left: 1100,
            top: 350,
            opacity: secCard.opacity * hudOut,
            transform: `scale(${secCard.scale})`,
            transformOrigin: "left center",
          }}
        >
          <div style={{ ...cardStyle, alignItems: "flex-start", padding: "34px 64px 40px" }}>
            <div style={{ fontSize: 200, fontWeight: 700, color: C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              2,5 s
            </div>
            <Words
              text="délai pour annuler"
              start={T.secLabel}
              frame={frame}
              style={{ fontSize: 48, fontWeight: 500, color: C.inkSoft, marginTop: 12 }}
            />
            <div
              style={{
                marginTop: 32,
                display: "inline-flex",
                alignItems: "center",
                gap: 16,
                padding: "18px 40px 18px 30px",
                borderRadius: 999,
                backgroundColor: buttonFill,
                opacity: buttonPop.opacity,
                transform: `scale(${buttonPop.scale * pulse(frame, T.buttonPulse)})`,
                transformOrigin: "left center",
              }}
            >
              <X size={44} color={C.ink} strokeWidth={4} absoluteStrokeWidth />
              <span style={{ fontSize: 48, fontWeight: 500, color: C.ink }}>Annuler</span>
            </div>
          </div>
        </div>
      )}

      <Camera x={camX} y={camY} zoom={zoom}>
        {/* Couche basse : onde et flèches */}
        <svg width={7000} height={1400} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {wave && (
            <path d={wave} fill="none" stroke={C.blue} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
          )}
          <Arrow x1={GLADIA.x + GLADIA.w / 2 + 8} x2={RING.x - RING.r - 30} p={outArrow} />
          <Arrow x1={RING.x + RING.r + 30} x2={FLY_ARROW_END} p={flyArrow} />
        </svg>

        {/* Plan 1 : case Gladia du raccord qui devient la pastille micro */}
        <div
          style={{
            position: "absolute",
            left: MIC_X - morphW / 2,
            top: AXIS - morphH / 2,
            width: morphW,
            height: morphH,
            boxSizing: "border-box",
            borderRadius: morphR,
            backgroundColor: morphFill,
            border: `4px solid ${C.blue}`,
            transform: `scale(${micPulse})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: MIC_X - 80,
            top: AXIS - 80,
            width: 160,
            height: 160,
            opacity: 1 - audioOut,
            transform: `scale(${1 - 0.4 * audioOut})`,
          }}
        >
          <AudioLines size={160} color={C.blue} strokeWidth={6} absoluteStrokeWidth />
        </div>
        <div
          style={{
            position: "absolute",
            left: MIC_X - 90,
            top: AXIS - 90,
            width: 180,
            height: 180,
            opacity: micIn.opacity,
            transform: `scale(${micIn.scale * micPulse})`,
          }}
        >
          <Mic size={180} color={C.ink} strokeWidth={6} absoluteStrokeWidth />
        </div>
        <Label x={MIC_X} top={AXIS + MIC_R + 34} text="Micro" start={T.micLabel} frame={frame} />

        {/* Plan 3 : Worker relaie, Gladia transcrit */}
        <Box
          x={WORKER.x}
          w={WORKER.w}
          h={WORKER.h}
          stroke={C.light}
          start={T.worker}
          frame={frame}
          scale={pulse(frame, T.workerHit)}
        >
          <Server size={110} color={C.light} strokeWidth={4} absoluteStrokeWidth />
        </Box>
        <Label x={WORKER.x} top={AXIS + WORKER.h / 2 + 30} text="Worker" start={T.worker + 6} frame={frame} />

        <Box
          x={GLADIA.x}
          w={GLADIA.w}
          h={GLADIA.h}
          stroke={C.blue}
          fill={C.gladia}
          start={T.gladia}
          frame={frame}
          scale={pulse(frame, T.gladiaHit)}
        >
          <AudioLines size={150} color={C.ink} strokeWidth={6} absoluteStrokeWidth />
        </Box>
        <Label x={GLADIA.x} top={AXIS + GLADIA.h / 2 + 30} text="Gladia STT" start={T.gladia + 6} frame={frame} />

        {/* Plan 4 : disque ardoise du texte, anneau qui se vide */}
        <svg width={7000} height={1400} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {frame >= T.ringIn && (
            <g
              opacity={ringPop.opacity}
              transform={`translate(${RING.x} ${AXIS}) scale(${ringScale}) translate(${-RING.x} ${-AXIS})`}
            >
              <circle cx={RING.x} cy={AXIS} r={RING.r - 22} fill={diskFill} />
              <circle cx={RING.x} cy={AXIS} r={RING.r} fill="none" stroke={C.light} strokeWidth={18} />
              <circle
                cx={RING.x}
                cy={AXIS}
                r={RING.r}
                fill="none"
                stroke={C.blue}
                strokeWidth={18}
                strokeLinecap="round"
                strokeDasharray={`${circ * remaining} ${circ}`}
                transform={`rotate(-90 ${RING.x} ${AXIS})`}
                opacity={remaining > 0.002 ? 1 : 0}
              />
            </g>
          )}
        </svg>

        {/* La porte refermée : coche une fois le texte parti */}
        <div
          style={{
            position: "absolute",
            left: RING.x - 80,
            top: AXIS - 80,
            width: 160,
            height: 160,
            opacity: checkPop.opacity,
            transform: `scale(${checkPop.scale})`,
          }}
        >
          <Check size={160} color={C.light} strokeWidth={8} absoluteStrokeWidth />
        </div>

        {/* Mots transcrits au cœur du disque, un à un, venant de Gladia */}
        <div
          style={{
            position: "absolute",
            left: RING.x - 260,
            top: AXIS - 110,
            width: 520,
            opacity: 1 - collapse,
            transform: `scale(${1 - 0.3 * collapse})`,
          }}
        >
          <Words
            text="Texte français"
            start={T.words}
            frame={frame}
            stagger={9}
            dx={-60}
            style={{
              flexDirection: "column",
              alignItems: "center",
              fontSize: 88,
              fontWeight: 600,
              color: C.ink,
              lineHeight: "110px",
            }}
          />
        </div>

        {/* Plan 5 : le texte validé devient un paquet indigo qui part vers la droite */}
        {frame >= T.collapse && (
          <div
            style={{
              position: "absolute",
              left: px - PACKET.w / 2,
              top: AXIS - PACKET.h / 2,
              width: PACKET.w,
              height: PACKET.h,
              boxSizing: "border-box",
              borderRadius: PACKET.h / 2,
              backgroundColor: C.gladia,
              border: `4px solid ${C.blue}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              opacity: interpolate(packetIn, [0, 1], [0, 1], clamp),
              transform: `scale(${0.6 + 0.4 * packetIn})`,
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, border: `3px solid ${C.ink}` }} />
            <span style={{ fontSize: 48, fontWeight: 500, color: C.ink, whiteSpace: "nowrap" }}>Texte français</span>
          </div>
        )}
      </Camera>

      {/* Titre de la séquence */}
      {headerOut > 0 && (
        <div style={{ position: "absolute", left: 110, top: 64, opacity: headerOut }}>
          <Words
            text="Gladia, transcription en direct"
            start={T.kicker}
            frame={frame}
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.inkSoft,
            }}
          />
          <Words
            text="1. Voix vers texte"
            start={T.title}
            frame={frame}
            style={{ fontSize: 88, fontWeight: 600, color: C.ink, marginTop: 10, lineHeight: 1.1 }}
          />
        </div>
      )}

      {/* Compteur 16 kHz plein écran au-dessus de l'onde, libellé sous l'onde */}
      {frame >= T.khz && khzOut > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 70,
              display: "flex",
              justifyContent: "center",
              opacity: khzCard.opacity * khzOut,
              transform: `scale(${khzCard.scale})`,
            }}
          >
            <div
              style={{
                fontSize: 260,
                fontWeight: 700,
                color: C.ink,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {formatFr(khzValue, 0)} kHz
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 770,
              display: "flex",
              justifyContent: "center",
              opacity: khzOut,
            }}
          >
            <div
              style={{
                padding: "12px 40px",
                borderRadius: 999,
                backgroundColor: C.slate,
                opacity: pop(frame, T.khzLabel).opacity,
                transform: `scale(${pop(frame, T.khzLabel).scale})`,
              }}
            >
              <Words
                text="flux audio"
                start={T.khzLabel + 2}
                frame={frame}
                style={{ fontSize: 48, fontWeight: 500, color: C.ink }}
              />
            </div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
