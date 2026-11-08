import { Image as ImageIcon, Keyboard, Monitor, MousePointerClick, OctagonX, Pointer, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp, keyframes } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Palette du site HoloRemote : accent unique bleu, cartes en ardoise, remplissages clairs.
// Les composants se distinguent par leur icône et leur libellé, jamais par une couleur.
const BLUE = "#3B82F6";
const SLATE = "#5660A7";
const LIGHT = "#DCE1FF";
const GREY = "#B7BEFF";
const INK_SOFT = "#EEF0FF";
const ARROW = "#FFFFFF";
const BG = "linear-gradient(180deg, #8692FF 0%, #D3DAFF 100%)";

// Courbes de la bible.
const easeInOutCubic = Easing.inOut(Easing.cubic);
const easeOutCubic = Easing.out(Easing.cubic);
const easeInCubic = Easing.in(Easing.cubic);
const easeInOutSine = Easing.inOut(Easing.sin);
const easeOutBack = Easing.out(Easing.back(1.3));
const easeOutQuart = Easing.out(Easing.poly(4));

const prog = (f: number, start: number, dur: number, easing: (t: number) => number = easeOutCubic) =>
  interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const exitOf = (f: number, start: number) => 1 - prog(f, start, 10, easeInCubic);

// Monde : le PC en bas, le téléphone au-dessus, une flèche entre eux.
const PC = { x: 2880, y: 2240, w: 900, h: 540 };
const PC_TOP = PC.y - PC.h / 2;
const SCREEN_W = 760;
const SCREEN_H = (SCREEN_W * 9) / 16;
const SCREEN_TOP = PC_TOP + 28;
const PHONE = { x: 2880, y: 1050, w: 520, h: 960 };
const FEED = { top: 700, bottom: 1310, w: 440 };
const BTN = { x: 2880, y: 1410, w: 400, h: 120 };
const ARROW_TOP = 1560;
const ARROW_BOTTOM = 1950;
const CAP_W = 400;
const SLOT_W = 420;

// Horaire.
const STOP = 236; // appui : tout le flux se fige
const WAVE = 238; // départ de l'onde
const WAVE_R = 1100; // rayon final de l'onde, px monde
const WAVE_DUR = 30;

const ff = (f: number) => Math.min(f, STOP);

// Instant où l'onde atteint un point (inverse de easeOutCubic).
const greyAt = (x: number, y: number) => {
  const d = Math.hypot(x - BTN.x, y - BTN.y);
  if (d >= WAVE_R) return Infinity;
  return WAVE + WAVE_DUR * (1 - Math.cbrt(1 - d / WAVE_R));
};
const greyness = (f: number, x: number, y: number) => {
  const at = greyAt(x, y);
  return Number.isFinite(at) ? prog(f, at, 6, easeOutCubic) : 0;
};

// Fil du téléphone : captures et pastilles d'action, empilées par le bas.
type FeedKind = "capture" | "clic" | "frappe";
type FeedItem = { at: number; kind: FeedKind; flown?: boolean };
const FEED_ITEMS: FeedItem[] = [
  { at: 108, kind: "capture", flown: true },
  { at: 126, kind: "capture" },
  { at: 146, kind: "clic" },
  { at: 164, kind: "frappe" },
  { at: 230, kind: "capture" }, // figée à mi-entrée par l'appui sur Stop
];
const ITEM_H: Record<FeedKind, number> = { capture: (SLOT_W * 9) / 16, clic: 80, frappe: 80 };
const GAP = 18;

// Texte mot par mot : 3 frames d'écart, montée de 16 px en 12 frames.
const Words = ({ text, start, frame, style }: { text: string; start: number; frame: number; style?: React.CSSProperties }) => (
  <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.26em", ...style }}>
    {text.split(" ").map((w, i) => {
      const p = prog(frame, start + i * 3, 12);
      return (
        <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
          {w}
        </span>
      );
    })}
  </div>
);

// Capture d'écran schématique : la même image sert d'écran au PC et de vignette.
const Screenshot = ({ w, color }: { w: number; color: string }) => {
  const h = (w * 9) / 16;
  const r = Math.max(14, w * 0.04);
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: r,
        border: `4px solid ${color}`,
        backgroundColor: LIGHT,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: "13%", backgroundColor: color }} />
      <div style={{ position: "absolute", left: "8%", top: "28%", width: "48%", height: "28%", borderRadius: r * 0.6, backgroundColor: SLATE }} />
      <div style={{ position: "absolute", left: "8%", top: "66%", width: "30%", height: "18%", borderRadius: r * 0.6, backgroundColor: SLATE }} />
      <div style={{ position: "absolute", right: "8%", top: "28%", width: "26%", height: "56%", borderRadius: r * 0.6, backgroundColor: color }} />
    </div>
  );
};

const Pill = ({ kind, color }: { kind: "clic" | "frappe"; color: string }) => {
  const Icon = kind === "clic" ? MousePointerClick : Keyboard;
  return (
    <div
      style={{
        height: 80,
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "0 32px 0 22px",
        borderRadius: 40,
        backgroundColor: SLATE,
        boxSizing: "border-box",
      }}
    >
      <Icon size={42} color={color} strokeWidth={3} />
      <span style={{ fontSize: 40, fontWeight: 500, color: theme.ink }}>{kind}</span>
    </div>
  );
};

// Libellé d'un plan, en haut à gauche de l'image.
const Label = ({ text, Icon, start, end, frame }: { text: string; Icon: LucideIcon; start: number; end: number; frame: number }) => {
  if (frame < start) return null;
  const op = exitOf(frame, end);
  if (op <= 0) return null;
  const pop = prog(frame, start, 15, easeOutBack);
  return (
    <AbsoluteFill style={{ padding: "110px 96px", opacity: op }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: SLATE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: prog(frame, start, 15, Easing.linear),
            transform: `scale(${0.85 + 0.15 * pop})`,
          }}
        >
          <Icon size={46} color={BLUE} strokeWidth={3} />
        </div>
        <Words text={text} start={start + 3} frame={frame} style={{ fontSize: 48, fontWeight: 500, color: theme.ink, maxWidth: 420, lineHeight: 1.2, paddingTop: 12 }} />
      </div>
    </AbsoluteFill>
  );
};

export const Scene = () => {
  const frame = useCurrentFrame();
  const fF = ff(frame);

  // Caméra : léger recul sur le PC, suivi de la capture qui monte, zoom dans le téléphone,
  // plongée sur le bouton, recul rapide qui montre l'onde, puis zoom lent.
  const camY = keyframes(
    frame,
    [
      [0, 2100],
      [56, 2100],
      [112, 1060],
      [120, 1060],
      [170, 1000],
      [182, 1000],
      [214, 1330],
      [236, 1340],
      [262, 1500],
      [299, 1480],
    ],
    easeInOutCubic,
  );
  const camZ = keyframes(
    frame,
    [
      [0, 1.3],
      [56, 1.1],
      [112, 1.0],
      [120, 1.0],
      [170, 1.35],
      [182, 1.35],
      [214, 1.55],
      [236, 1.58],
      [262, 0.6],
      [299, 0.624],
    ],
    easeInOutCubic,
  );
  // Le téléphone glisse à droite de l'image : les libellés gardent leur place à gauche.
  const camX = keyframes(
    frame,
    [
      [0, PC.x],
      [58, PC.x],
      [112, PC.x - 150],
      [238, PC.x - 150],
      [262, PC.x],
    ],
    easeInOutCubic,
  );
  // Secousse de 4 px sur 6 frames à l'appui.
  const shakeT = frame - STOP;
  const shake = shakeT >= 0 && shakeT < 6 ? 4 * Math.sin(shakeT * Math.PI * 1.5) * (1 - shakeT / 6) : 0;

  // Flèche PC → téléphone, grise une fois l'onde passée.
  const arrowDraw = prog(frame, 34, 22, easeInOutCubic);
  const arrowHead = prog(frame, 54, 6, Easing.linear);
  const arrowGrey = greyness(frame, PC.x, (ARROW_TOP + ARROW_BOTTOM) / 2);
  const arrowColor = interpolateColors(arrowGrey, [0, 1], [ARROW, GREY]);

  // PC.
  const pcGrey = greyness(frame, PC.x, PC_TOP);
  const pcColor = interpolateColors(pcGrey, [0, 1], [BLUE, GREY]);
  const flash = interpolate(frame, [18, 20, 30], [0, 0.7, 0], clamp);

  // Téléphone.
  const phonePop = prog(frame, 80, 15, easeOutBack);
  const phoneOp = prog(frame, 80, 15, Easing.linear);

  // Fil : chaque élément entre par le bas et pousse les précédents, figé à l'appui.
  const lift = FEED_ITEMS.map((it) => (it.flown ? (fF >= it.at ? 1 : 0) : prog(fF, it.at, 14, easeOutCubic)));

  // Capture en vol : se détache de l'écran, monte la flèche, entre dans le fil.
  const cap = (() => {
    if (frame < 18 || frame >= 108) return null;
    let x = PC.x;
    let y: number;
    let w: number;
    if (frame < 40) {
      const t = prog(frame, 18, 22, easeInOutCubic);
      y = lerp(SCREEN_TOP + SCREEN_H / 2, PC_TOP, t);
      w = lerp(SCREEN_W, CAP_W, t);
    } else if (frame < 64) {
      y = PC_TOP;
      w = CAP_W;
    } else if (frame < 92) {
      const t = prog(frame, 64, 28, easeInOutSine);
      y = lerp(PC_TOP, 1660, t);
      w = CAP_W;
    } else {
      const t = prog(frame, 92, 16, easeInOutCubic);
      y = lerp(1660, FEED.bottom - ITEM_H.capture / 2, t);
      w = lerp(CAP_W, SLOT_W, t);
      x = PC.x;
    }
    return { x, y, w };
  })();

  // Bouton Stop.
  const btnPop = prog(frame, 182, 15, easeOutBack);
  const btnOp = prog(frame, 182, 15, Easing.linear);
  const pulse = frame >= 200 && frame < STOP ? 0.04 * (1 - Math.cos((2 * Math.PI * (frame - 200)) / 30)) : 0;
  const pressDown = prog(frame, STOP, 4, easeOutQuart);
  const pressUp = prog(frame, STOP + 4, 10, easeOutQuart);
  const btnScale = (0.85 + 0.15 * btnPop) * (1 + pulse) * (1 - 0.08 * pressDown + 0.08 * pressUp);

  // Doigt schématique.
  const fIn = prog(frame, 200, STOP - 200, easeInOutCubic);
  const fOut = prog(frame, 244, 20, easeInOutCubic);
  const tipX = lerp(lerp(3160, 2950, fIn), 3200, fOut);
  const tipY = lerp(lerp(1800, 1430, fIn), 1820, fOut);
  const fingerOp = prog(frame, 200, 8, Easing.linear) * exitOf(frame, 256);

  // Onde unique du Stop.
  const waveT = prog(frame, WAVE, WAVE_DUR, easeOutCubic);
  const waveOn = frame >= WAVE && waveT < 1;

  // Titres.
  const kickerOp = exitOf(frame, 26);
  const titleOp = exitOf(frame, 56);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: theme.font }}>
      <Camera x={camX + shake} y={camY} zoom={camZ}>
        <div style={{ position: "relative", width: 5760, height: 3240 }}>
          {/* Flèche du PC vers le téléphone */}
          <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {arrowDraw > 0 && (
              <line
                x1={PC.x}
                x2={PC.x}
                y1={ARROW_BOTTOM}
                y2={lerp(ARROW_BOTTOM, ARROW_TOP + 18, arrowDraw)}
                stroke={arrowColor}
                strokeWidth={6}
                strokeLinecap="round"
              />
            )}
            <polygon
              points={`${PC.x},${ARROW_TOP} ${PC.x - 14},${ARROW_TOP + 24} ${PC.x + 14},${ARROW_TOP + 24}`}
              fill={arrowColor}
              opacity={arrowHead}
            />
          </svg>

          {/* PC : cadre ardoise, écran clair, icône Monitor dans le pied */}
          <div
            style={{
              position: "absolute",
              left: PC.x - PC.w / 2,
              top: PC_TOP,
              width: PC.w,
              height: PC.h,
              borderRadius: 48,
              border: `4px solid ${pcColor}`,
              backgroundColor: SLATE,
              boxSizing: "border-box",
            }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center" }}>
              <Monitor size={48} color={pcColor} strokeWidth={3} />
            </div>
          </div>
          <div style={{ position: "absolute", left: PC.x - SCREEN_W / 2, top: SCREEN_TOP }}>
            <Screenshot w={SCREEN_W} color={pcColor} />
            {flash > 0 && <div style={{ position: "absolute", inset: 0, borderRadius: 30, backgroundColor: "#FFFFFF", opacity: flash }} />}
          </div>

          {/* Téléphone */}
          <div
            style={{
              position: "absolute",
              left: PHONE.x - PHONE.w / 2,
              top: PHONE.y - PHONE.h / 2,
              width: PHONE.w,
              height: PHONE.h,
              borderRadius: 64,
              border: `4px solid ${BLUE}`,
              backgroundColor: SLATE,
              boxSizing: "border-box",
              opacity: phoneOp,
              transform: `scale(${0.85 + 0.15 * phonePop})`,
            }}
          >
            <div style={{ position: "absolute", left: 14, top: 14, right: 14, bottom: 14, borderRadius: 50, backgroundColor: LIGHT }} />
            <div
              style={{
                position: "absolute",
                left: 34,
                right: 34,
                top: 30,
                height: 76,
                borderRadius: 38,
                backgroundColor: SLATE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <Smartphone size={40} color={BLUE} strokeWidth={3} />
              <span style={{ fontSize: 40, fontWeight: 500, color: theme.ink }}>Téléphone</span>
            </div>
          </div>

          {/* Fil des captures et des actions */}
          <div
            style={{
              position: "absolute",
              left: PHONE.x - FEED.w / 2,
              top: FEED.top,
              width: FEED.w,
              height: FEED.bottom - FEED.top,
              overflow: "hidden",
              opacity: phoneOp,
            }}
          >
            {FEED_ITEMS.map((it, i) => {
              if (fF < it.at) return null;
              const h = ITEM_H[it.kind];
              let up = 0;
              for (let j = i + 1; j < FEED_ITEMS.length; j++) up += lift[j]! * (ITEM_H[FEED_ITEMS[j]!.kind] + GAP);
              const enter = (1 - lift[i]!) * (h + GAP);
              const y = up - enter;
              const g = greyness(frame, PHONE.x, FEED.bottom - y - h / 2);
              const color = interpolateColors(g, [0, 1], [BLUE, GREY]);
              const isCap = it.kind === "capture";
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: isCap ? (FEED.w - SLOT_W) / 2 : 10,
                    bottom: 0,
                    transform: `translateY(${-y}px)`,
                  }}
                >
                  {isCap ? <Screenshot w={SLOT_W} color={color} /> : <Pill kind={it.kind as "clic" | "frappe"} color={color} />}
                </div>
              );
            })}
          </div>

          {/* Capture en vol */}
          {cap && (
            <div style={{ position: "absolute", left: cap.x - cap.w / 2, top: cap.y - (cap.w * 9) / 32 }}>
              <Screenshot w={cap.w} color={BLUE} />
            </div>
          )}

          {/* Bouton Stop */}
          {frame >= 182 && (
            <div
              style={{
                position: "absolute",
                left: BTN.x - BTN.w / 2,
                top: BTN.y - BTN.h / 2,
                width: BTN.w,
                height: BTN.h,
                borderRadius: BTN.h / 2,
                backgroundColor: BLUE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                opacity: btnOp,
                transform: `scale(${btnScale})`,
              }}
            >
              <OctagonX size={58} color="#FFFFFF" strokeWidth={3} />
              <span style={{ fontSize: 52, fontWeight: 600, color: theme.ink }}>Stop</span>
            </div>
          )}

          {/* Onde du Stop : un seul cercle qui gagne le PC */}
          {waveOn && (
            <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <circle cx={BTN.x} cy={BTN.y} r={Math.max(1, WAVE_R * waveT)} fill="none" stroke={BLUE} strokeWidth={8 / camZ} opacity={1 - waveT} />
            </svg>
          )}

          {/* Doigt */}
          {fingerOp > 0 && (
            <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: fingerOp }}>
              <g transform={`translate(${tipX} ${tipY}) rotate(-35)`}>
                <rect x={-44} y={-10} width={88} height={460} rx={44} fill={LIGHT} stroke={SLATE} strokeWidth={6} />
              </g>
            </svg>
          )}
        </div>
      </Camera>

      {/* Kicker, puis titre */}
      {kickerOp > 0 && (
        <AbsoluteFill style={{ padding: "110px 96px", opacity: kickerOp }}>
          <Words
            text="Captures et bouton Stop de l'agent"
            start={-40}
            frame={frame}
            style={{ fontSize: 28, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: INK_SOFT }}
          />
        </AbsoluteFill>
      )}
      {titleOp > 0 && (
        <AbsoluteFill style={{ padding: "100px 96px", opacity: titleOp }}>
          <Words text="4. Tout en direct" start={28} frame={frame} style={{ fontSize: 88, fontWeight: 600, color: theme.ink }} />
        </AbsoluteFill>
      )}

      {/* Libellés des plans */}
      <Label text="Captures de l'écran" Icon={ImageIcon} start={68} end={114} frame={frame} />
      <Label text="Chaque action revient" Icon={MousePointerClick} start={124} end={178} frame={frame} />
      <Label text="Stop de l'agent" Icon={OctagonX} start={188} end={234} frame={frame} />
      <Label text="Un bouton arrête l'agent" Icon={Pointer} start={246} end={DURATION + 20} frame={frame} />
    </AbsoluteFill>
  );
};
