import { Bot, Cable, Cloud, Eye, Keyboard, MousePointerClick, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Palette du site HoloRemote : un seul accent bleu, cartes en ardoise, remplissages clairs.
const C = {
  blue: "#3B82F6",
  slate: "#5660A7",
  light: "#DCE1FF",
  off: "#B7BEFF",
  white: "#FFFFFF",
  kicker: "#EEF0FF",
  bgTop: "#8692FF",
  bgBottom: "#D3DAFF",
};

const EASE_IO = Easing.inOut(Easing.cubic);
const SINE = Easing.inOut(Easing.sin);
const OUT_CUBIC = Easing.out(Easing.cubic);
const IN_CUBIC = Easing.in(Easing.cubic);
const BACK = Easing.out(Easing.back(1.7));
const LINEAR = Easing.linear;

const prog = (f: number, start: number, dur: number, easing: (t: number) => number = OUT_CUBIC) =>
  interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing });
const exit = (f: number, start: number) => 1 - prog(f, start, 10, IN_CUBIC);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bump = (f: number, at: number, dur = 16) => (f < at || f > at + dur ? 0 : Math.sin((Math.PI * (f - at)) / dur));

type Pt = [number, number];
const quad = (p0: Pt, c: Pt, p2: Pt, t: number): Pt => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1],
];

// Géométrie du monde : la chaîne sur une ligne, la capture au-dessus de Holo, le PC sous la chaîne.
const Y = 1600;
const WORKER = 800;
const API = 1600;
const HOLO = 2400;
const PONT = 3200;
const HALF = 120;

const SHOT = { x: 1760, y: 280, w: 1280, h: 720 }; // capture vue par Holo
const PC_S = 0.6875;
const PC = { x: 1960, y: 2060 }; // origine de l'écran du PC
const PC_CX = 2400;
const local = (o: { x: number; y: number }, s: number, lx: number, ly: number): Pt => [o.x + lx * s, o.y + ly * s];
const BTN_L: Pt = [470, 488];
const FIELD_L: Pt = [700, 338];
const R1 = local(SHOT, 1, ...BTN_L);
const R2 = local(SHOT, 1, ...FIELD_L);
const PC_BTN = local(PC, PC_S, ...BTN_L);
const PC_FIELD = local(PC, PC_S, ...FIELD_L);
// Pastilles posées à côté des réticules : « clic » sous le bouton, « frappe » au-dessus du champ.
const PILL1 = { left: R1[0] - 115, cy: R1[1] + 185 };
const PILL2 = { left: R2[0] + 140, cy: R2[1] - 160 };
const S1: Pt = [PILL1.left + 52, PILL1.cy];
const S2: Pt = [PILL2.left + 52, PILL2.cy];
const PONT_C: Pt = [PONT, Y];

// Tête du flux de l'ouverture : un seul paquet bleu.
const lead = (f: number) => {
  if (f < 16) return lerp(420, WORKER - HALF, prog(f, 0, 16, SINE));
  if (f < 22) return WORKER;
  if (f < 44) return 940 + 520 * prog(f, 22, 22, EASE_IO);
  if (f < 50) return lerp(1460, 1740, (f - 44) / 6);
  if (f < 72) return 1740 + 520 * prog(f, 50, 22, EASE_IO);
  return 2260;
};

// Paquets : capture → pont → PC.
// Le paquet entre dans la case Pont et ressort sous son libellé, sans jamais le croiser.
const PONT_OUT: Pt = [PONT - 60, Y + HALF + 24 + 80 + 8 + 20];
const packetAt = (f: number, t0: number, start: Pt, target: Pt): Pt => {
  if (f < t0) return start;
  if (f < t0 + 22) return quad(start, [PONT, start[1]], PONT_C, prog(f, t0, 22, SINE));
  if (f < t0 + 24) return PONT_C;
  if (f < t0 + 42) return quad(PONT_OUT, [PONT - 120, 2000], target, prog(f, t0 + 24, 18, SINE));
  return target;
};
// Taille du paquet : il rétrécit en entrant dans la case, puis réapparaît sous le libellé.
const packetScale = (f: number, t0: number) =>
  f < t0 + 22 ? prog(f, t0, 8, BACK) * (1 - prog(f, t0 + 18, 4, LINEAR)) : f < t0 + 24 ? 0 : prog(f, t0 + 24, 4, LINEAR);

// Fin du plan large : tout s'efface sauf Holo, puis resserrage sur le raccord.
const END = 286;
// Échelle des cases : agrandies de 1,4 pour le plan large, ramenées à 1 pour le raccord final.
const boxScaleAt = (f: number) =>
  f < END ? lerp(1, 1.4, prog(f, 244, 24, EASE_IO)) : lerp(1.4, 1, prog(f, END, 12, EASE_IO));
const labelScaleOf = (bs: number) => 1 + (bs - 1) * 0.625;
const P1_T = 196;
const P2_T = 202;
const CLICK = P1_T + 42; // 238
const TYPE = P2_T + 42; // 244
const p1At = (f: number) => packetAt(f, P1_T, S1, PC_BTN);
const p2At = (f: number) => packetAt(f, P2_T, S2, PC_FIELD);

// Caméra.
type Cam = { x: number; y: number; z: number };
const lerpCam = (a: Cam, b: Cam, q: number): Cam => ({ x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), z: lerp(a.z, b.z, q) });
const K_SCAN: [number, Cam][] = [
  [112, { x: 2400, y: 650, z: 1.3 }],
  [135, { x: 2400, y: 650, z: 1.35 }],
  [150, { x: 2300, y: 740, z: 1.6 }],
  [162, { x: 2312, y: 734, z: 1.6 }],
  [176, { x: 2440, y: 640, z: 1.45 }],
  [190, { x: 2448, y: 636, z: 1.45 }],
];
const keyCam = (f: number, keys: [number, Cam][]): Cam => {
  for (let i = 1; i < keys.length; i++) {
    const [f0, a] = keys[i - 1]!;
    const [f1, b] = keys[i]!;
    if (f <= f1) return lerpCam(a, b, prog(f, f0, f1 - f0, EASE_IO));
  }
  return keys[keys.length - 1]![1];
};
// Suivi du paquet (retard de 6 frames), borné pour garder Holo, le Pont et leurs libellés entiers.
const shot4 = (f: number): Cam => {
  const t = p1At(f - 6);
  const w = prog(f, 190, 18, EASE_IO);
  const tx = Math.min(2950, Math.max(2600, t[0] + 250));
  const ty = Math.min(1400, Math.max(1290, t[1] + 350));
  return { x: lerp(2448, tx, w), y: lerp(636, ty, w), z: lerp(1.45, 0.9, w) };
};
const MON: Cam = { x: PC_CX, y: 2330, z: 1.2 };
const MON2: Cam = { x: PC_CX, y: 2330, z: 1.24 };
// Plan large : la chaîne seule, au centre.
const WIDE: Cam = { x: 2000, y: 1660, z: 0.62 };
const WIDE2: Cam = { x: 2000, y: 1655, z: 0.64 };
const FINAL: Cam = { x: HOLO, y: Y - 60, z: 1 };

// Ouverture serrée (1,6) sur le Worker et le paquet entrant, la case API visible au bord droit.
const OPEN_X = 1100;
const OPEN_Y = 1560;
const camAt = (f: number): Cam => {
  if (f < 72) return { x: Math.max(OPEN_X, lead(f - 6)), y: OPEN_Y, z: lerp(1.6, 1.4, prog(f, 18, 30, EASE_IO)) };
  if (f < 112) {
    const q = prog(f, 72, 40, EASE_IO);
    const z = f < 90 ? lerp(1.4, 0.95, prog(f, 72, 18, EASE_IO)) : lerp(0.95, 1.3, prog(f, 90, 22, EASE_IO));
    return { x: lerp(Math.max(OPEN_X, lead(66)), HOLO, q), y: lerp(OPEN_Y, 650, q), z };
  }
  if (f < 190) return keyCam(f, K_SCAN);
  if (f < 218) return shot4(f);
  if (f < 236) return lerpCam(shot4(218), MON, prog(f, 218, 18, EASE_IO));
  if (f < 244) return lerpCam(MON, MON2, prog(f, 236, 8, SINE));
  if (f < 268) return lerpCam(MON2, WIDE, prog(f, 244, 24, EASE_IO));
  if (f < END) return lerpCam(WIDE, WIDE2, prog(f, 268, END - 268, SINE));
  return lerpCam(WIDE2, FINAL, prog(f, END, 299 - END, EASE_IO));
};

// Texte mot par mot : 3 frames d'écart, montée de 16 px, fondu en 12 frames.
const Words = ({ text, start, f, style }: { text: string; start: number; f: number; style?: React.CSSProperties }) => (
  <div style={{ display: "flex", flexWrap: "nowrap", columnGap: "0.26em", whiteSpace: "nowrap", ...style }}>
    {text.split(" ").map((w, i) => {
      const p = prog(f, start + i * 3, 12);
      return (
        <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
          {w}
        </span>
      );
    })}
  </div>
);

// Libellé sous une case : texte blanc sur carte ardoise, lisible sur le dégradé clair.
const Label = ({ x, text, start, f, opacity, bs }: { x: number; text: string; start: number; f: number; opacity: number; bs: number }) => {
  const o = prog(f, start, 12, LINEAR) * opacity;
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 500,
        top: Y + HALF * bs + 24,
        width: 1000,
        display: "flex",
        justifyContent: "center",
        opacity: o,
        transformOrigin: "50% 0",
        transform: `scale(${labelScaleOf(bs)})`,
      }}
    >
      <div style={{ backgroundColor: C.slate, borderRadius: 40, padding: "8px 36px" }}>
        <Words text={text} start={start} f={f} style={{ fontSize: 48, fontWeight: 500, color: theme.ink }} />
      </div>
    </div>
  );
};

type BoxProps = {
  x: number;
  Icon: LucideIcon;
  f: number;
  popAt: number | null;
  pulses: number[];
  fade: number;
  bs: number;
};

const Box = ({ x, Icon, f, popAt, pulses, fade, bs }: BoxProps) => {
  const p = popAt === null ? 1 : prog(f, popAt, 15, BACK);
  const o = popAt === null ? 1 : prog(f, popAt, 15, LINEAR);
  const pulse = pulses.reduce((acc, at) => acc * (1 + 0.08 * bump(f, at)), 1);
  return (
    <div
      style={{
        position: "absolute",
        left: x - HALF,
        top: Y - HALF,
        width: 240,
        height: 240,
        boxSizing: "border-box",
        borderRadius: 32,
        border: `4px solid ${C.blue}`,
        backgroundColor: C.slate,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: o * fade,
        transform: `scale(${(0.85 + 0.15 * p) * pulse * bs})`,
      }}
    >
      <Icon size={112} strokeWidth={3} absoluteStrokeWidth color={C.blue} />
    </div>
  );
};

// Flèche blanche qui se trace, tête en fin de tracé.
const Arrow = ({ a, b, p, opacity = 1 }: { a: Pt; b: Pt; p: number; opacity?: number }) => {
  if (p <= 0 || opacity <= 0) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const end = Math.max(0, Math.min(len * p, len - 18));
  const ho = interpolate(p, [0.85, 1], [0, 1], clamp);
  const bx = b[0] - ux * 20;
  const by = b[1] - uy * 20;
  return (
    <g opacity={opacity}>
      <line x1={a[0]} y1={a[1]} x2={a[0] + ux * end} y2={a[1] + uy * end} stroke={C.white} strokeWidth={6} strokeLinecap="round" />
      {ho > 0 && (
        <polygon points={`${b[0]},${b[1]} ${bx - uy * 13},${by + ux * 13} ${bx + uy * 13},${by - ux * 13}`} fill={C.white} opacity={ho} />
      )}
    </g>
  );
};

const Packet = ({ p, s = 1 }: { p: Pt; s?: number }) => (
  <circle cx={p[0]} cy={p[1]} r={14 * s} fill={C.blue} stroke={C.white} strokeWidth={3} />
);

const Ripple = ({ at, p, f }: { at: number; p: Pt; f: number }) => {
  const t = prog(f, at, 20, OUT_CUBIC);
  if (f < at || t >= 1) return null;
  return <circle cx={p[0]} cy={p[1]} r={300 * t} fill="none" stroke={C.blue} strokeWidth={4} opacity={1 - t} />;
};

const Reticle = ({ p, f, at, out }: { p: Pt; f: number; at: number; out: number }) => {
  const t = prog(f, at, 14, OUT_CUBIC);
  const o = prog(f, at, 8, LINEAR) * exit(f, out);
  if (o <= 0) return null;
  const s = lerp(2.2, 1, t);
  return (
    <g transform={`translate(${p[0]} ${p[1]}) scale(${s})`} opacity={o}>
      <circle r={80} fill="none" stroke={C.blue} strokeWidth={6} />
      <circle r={10} fill={C.blue} />
      {[
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].map(([dx, dy], i) => (
        <line key={i} x1={dx! * 58} y1={dy! * 58} x2={dx! * 108} y2={dy! * 108} stroke={C.blue} strokeWidth={6} strokeLinecap="round" />
      ))}
    </g>
  );
};

// Écran schématique épuré : une fenêtre claire, un titre, un champ de texte, un bouton.
type DesktopProps = { s: number; scanY: number | null; press: number; pressed: number; typed: number; caret: boolean };
const Desktop = ({ s, scanY, press, pressed, typed, caret }: DesktopProps) => {
  const hl = (yc: number) => (scanY === null ? 0 : Math.max(0, 1 - Math.abs(scanY - yc) / 70));
  const btnColor = interpolateColors(pressed, [0, 1], [C.slate, C.blue]);
  const bs = 1 - 0.08 * press;
  return (
    <svg width={1280 * s} height={720 * s} viewBox="0 0 1280 720" style={{ display: "block", overflow: "visible" }}>
      <rect x={2} y={2} width={1276} height={716} rx={48} fill={C.light} stroke={C.white} strokeWidth={4} />
      <rect x={320} y={110} width={440} height={40} rx={20} fill={interpolateColors(hl(130), [0, 1], [C.off, C.blue])} />
      <rect x={320} y={290} width={760} height={96} rx={48} fill={C.white} stroke={C.off} strokeWidth={4} />
      <rect x={320} y={290} width={760} height={96} rx={48} fill="none" stroke={C.blue} strokeWidth={6} opacity={hl(338)} />
      {Array.from({ length: typed }, (_, i) => (
        <rect key={i} x={362 + i * 48} y={318} width={36} height={40} rx={10} fill={C.slate} />
      ))}
      {caret && <rect x={362 + typed * 48} y={312} width={6} height={52} rx={3} fill={C.slate} />}
      <g transform={`translate(470 488) scale(${bs}) translate(-470 -488)`}>
        <rect x={320} y={440} width={300} height={96} rx={48} fill={btnColor} />
        <rect x={400} y={479} width={140} height={18} rx={9} fill={C.white} />
        <rect x={320} y={440} width={300} height={96} rx={48} fill="none" stroke={C.blue} strokeWidth={6} opacity={hl(488)} />
      </g>
      {scanY !== null && <line x1={24} x2={1256} y1={scanY} y2={scanY} stroke={C.blue} strokeWidth={6} strokeLinecap="round" />}
    </svg>
  );
};

type PillProps = { left: number; cy: number; Icon: LucideIcon; text: string; f: number; at: number; out?: number };
const Pill = ({ left, cy, Icon, text, f, at, out = 190 }: PillProps) => {
  const p = prog(f, at, 15, BACK);
  const o = prog(f, at, 15, LINEAR) * (1 - prog(f, out, 10, IN_CUBIC));
  if (o <= 0) return null;
  const collapse = lerp(1, 0.4, prog(f, out, 10, IN_CUBIC));
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: cy - 48,
        height: 96,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 34px 0 20px",
        borderRadius: 48,
        border: `4px solid ${C.blue}`,
        backgroundColor: C.slate,
        opacity: o,
        transformOrigin: "52px 50%",
        transform: `scale(${(0.85 + 0.15 * p) * collapse})`,
      }}
    >
      <Icon size={56} strokeWidth={3} absoluteStrokeWidth color={C.blue} />
      <span style={{ fontSize: 48, fontWeight: 500, color: theme.ink, whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
};

export const Scene = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);

  // Effacement final : seule la case Holo, sa ligne de tâche et le « ? » restent.
  const fade = exit(f, END);
  const bs = boxScaleAt(f);
  const h = HALF * bs + 20;

  // Flèche API → Holo qui devient la ligne de tâche bleue du raccord.
  const tl = prog(f, END, 12, EASE_IO);
  const a2p = prog(f, 50, 22, EASE_IO);
  const a2start = API + h;
  const a2tip = HOLO - h;
  const a2x1 = lerp(a2start, 0, tl);
  const a2end = lerp(a2start + (a2tip - 18 - a2start) * a2p, HOLO - HALF * bs, tl);
  const a2color = interpolateColors(tl, [0, 1], [C.white, C.blue]);
  const a2head = interpolate(a2p, [0.85, 1], [0, 1], clamp) * (1 - prog(f, END, 10, IN_CUBIC));

  // Capture vue par Holo : apparition, puis absorption dans la case Holo.
  const shotPop = prog(f, 74, 15, BACK);
  const shotIn = prog(f, 74, 15, LINEAR);
  const absorb = prog(f, 248, 18, EASE_IO);
  const shotOpacity = shotIn * (1 - prog(f, 258, 8, IN_CUBIC));
  const scanY = f >= 86 && f < 134 ? interpolate(f, [88, 132], [70, 650], clamp) : null;

  // Œil de Holo qui balaie la capture.
  const eyeLy = interpolate(f, [88, 132], [70, 650], clamp);
  // Le balayage reste dans la moitié gauche : le libellé à droite ne recouvre jamais l'œil.
  const eyeLx = 380 + 300 * Math.sin((Math.min(Math.max(f, 88), 132) - 88) * 0.22);
  const eyeO = prog(f, 80, 15, LINEAR) * exit(f, 136);
  const eyeS = 0.85 + 0.15 * prog(f, 80, 15, BACK);

  // PC : clic puis frappe, puis l'écran s'efface pour le plan large de la chaîne.
  const typed = f < TYPE ? 0 : Math.min(7, Math.floor((f - TYPE) / 2) + 1);
  const caret = f >= TYPE && Math.floor((f - TYPE) / 8) % 2 === 0;
  const pcO = prog(f, 198, 15, LINEAR) * exit(f, 252);

  // Paquet de l'ouverture.
  const lx = lead(f);
  const openS = f < 16 ? 1 : f >= 22 && f < 44 ? prog(f, 22, 6) : f >= 50 && f < 72 ? prog(f, 50, 6) : 0;

  const qO = prog(f, 266, 15, LINEAR);
  const qS = 0.85 + 0.15 * prog(f, 266, 15, BACK);

  // Kicker et titre ensemble dès l'ouverture, puis libellés un à un.
  const kickerO = exit(f, 60);
  const titleO = exit(f, 88);
  const a4y = Y + HALF * bs + 24 + 80 * labelScaleOf(bs) + 8;
  const seeO = prog(f, 96, 12, LINEAR) * exit(f, 136);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`, fontFamily: theme.font }}>
      <Camera x={cam.x} y={cam.y} zoom={cam.z}>
        <div style={{ position: "relative", width: 5760, height: 3240 }}>
          {/* Flèches de la chaîne */}
          <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <Arrow a={[WORKER + h, Y]} b={[API - h, Y]} p={prog(f, 22, 22, EASE_IO)} opacity={fade} />
            {a2p > 0 && (
              <g>
                <line x1={a2x1} y1={Y} x2={a2end} y2={Y} stroke={a2color} strokeWidth={lerp(6, 8, tl)} strokeLinecap={tl > 0 ? "butt" : "round"} />
                {a2head > 0 && (
                  <polygon points={`${a2tip},${Y} ${a2tip - 20},${Y - 13} ${a2tip - 20},${Y + 13}`} fill={C.white} opacity={a2head} />
                )}
              </g>
            )}
            <Arrow a={[HOLO + h, Y]} b={[PONT - h, Y]} p={prog(f, 192, 20, EASE_IO)} opacity={fade} />
            <Arrow a={[PONT - 60, a4y]} b={[2790, 2036]} p={prog(f, 200, 18, EASE_IO)} opacity={exit(f, 246)} />
            <Arrow a={[HOLO, 1020]} b={[HOLO, 1460]} p={prog(f, 76, 20, EASE_IO)} opacity={exit(f, 248)} />
          </svg>

          {/* Capture d'écran vue par Holo */}
          {shotOpacity > 0 && (
            <div
              style={{
                position: "absolute",
                left: SHOT.x,
                top: SHOT.y,
                width: SHOT.w,
                height: SHOT.h,
                opacity: shotOpacity,
                transform: `translateY(${absorb * (Y - (SHOT.y + SHOT.h / 2))}px) scale(${(0.85 + 0.15 * shotPop) * lerp(1, 0.12, absorb)})`,
              }}
            >
              <Desktop s={1} scanY={scanY} press={0} pressed={0} typed={0} caret={false} />
            </div>
          )}

          {/* Cases de la chaîne */}
          <Box x={WORKER} Icon={Server} f={f} popAt={null} pulses={[16]} fade={fade} bs={bs} />
          <Box x={API} Icon={Cloud} f={f} popAt={4} pulses={[44]} fade={fade} bs={bs} />
          <Box x={PONT} Icon={Cable} f={f} popAt={194} pulses={[P1_T + 22, P2_T + 22]} fade={fade} bs={bs} />
          <Label x={WORKER} text="Worker" start={-20} f={f} opacity={fade} bs={bs} />
          <Label x={API} text="API Agents de H" start={40} f={f} opacity={fade} bs={bs} />
          <Label x={HOLO} text="Holo voit l'écran" start={196} f={f} opacity={fade} bs={bs} />
          <Label x={PONT} text="Pont sur le PC" start={200} f={f} opacity={fade} bs={bs} />

          {/* Case Holo : reste seule à la fin */}
          <div
            style={{
              position: "absolute",
              left: HOLO - HALF,
              top: Y - HALF,
              width: 240,
              height: 240,
              boxSizing: "border-box",
              borderRadius: 32,
              border: `4px solid ${C.blue}`,
              backgroundColor: C.slate,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: prog(f, 58, 15, LINEAR),
              transform: `scale(${(0.85 + 0.15 * prog(f, 58, 15, BACK)) * (1 + 0.08 * bump(f, 72)) * (1 + 0.08 * bump(f, 266)) * bs})`,
            }}
          >
            <Bot size={112} strokeWidth={3} absoluteStrokeWidth color={C.blue} />
          </div>

          {/* PC : écran qui reçoit les gestes */}
          {pcO > 0 && (
            <div style={{ opacity: pcO }}>
              <div
                style={{
                  position: "absolute",
                  left: PC.x - 20,
                  top: PC.y - 20,
                  width: 920,
                  height: 535,
                  boxSizing: "border-box",
                  borderRadius: 48,
                  border: `4px solid ${C.blue}`,
                  backgroundColor: C.slate,
                  transformOrigin: "50% 50%",
                  transform: `scale(${0.85 + 0.15 * prog(f, 198, 15, BACK)})`,
                }}
              >
                <div style={{ position: "absolute", left: 16, top: 16 }}>
                  <Desktop s={PC_S} scanY={null} press={bump(f, CLICK, 10)} pressed={prog(f, CLICK, 6, LINEAR)} typed={typed} caret={caret} />
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: PC_CX - 150,
                  top: PC.y + 540,
                  width: 300,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: C.slate,
                }}
              />
            </div>
          )}

          {/* Cibles posées par Holo */}
          <Pill left={PILL1.left} cy={PILL1.cy} Icon={MousePointerClick} text="clic" f={f} at={152} />
          <Pill left={PILL2.left} cy={PILL2.cy} Icon={Keyboard} text="frappe" f={f} at={180} />

          {/* Œil de Holo */}
          {eyeO > 0 && (
            <div
              style={{
                position: "absolute",
                left: SHOT.x + eyeLx - 70,
                top: SHOT.y + eyeLy - 70,
                width: 140,
                height: 140,
                boxSizing: "border-box",
                borderRadius: 70,
                border: `4px solid ${C.blue}`,
                backgroundColor: C.slate,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: eyeO,
                transform: `scale(${eyeS})`,
              }}
            >
              <Eye size={72} strokeWidth={3} absoluteStrokeWidth color={C.blue} />
            </div>
          )}

          {/* Libellé du balayage : à droite de la zone balayée, à plus de 24 px de l'œil */}
          {seeO > 0 && (
            <div
              style={{
                position: "absolute",
                left: SHOT.x + 782,
                top: SHOT.y + 200 - 48,
                height: 96,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 34px 0 20px",
                borderRadius: 48,
                border: `4px solid ${C.blue}`,
                backgroundColor: C.slate,
                opacity: seeO,
              }}
            >
              <Eye size={56} strokeWidth={3} absoluteStrokeWidth color={C.blue} />
              <Words text="Holo voit l'écran" start={96} f={f} style={{ fontSize: 48, fontWeight: 500, color: theme.ink }} />
            </div>
          )}

          {/* Point d'interrogation : Holo s'arrête */}
          {qO > 0 && (
            <div
              style={{
                position: "absolute",
                left: HOLO - 200,
                top: Y - 320 - (bs - 1) * 120,
                width: 400,
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 140,
                fontWeight: 700,
                lineHeight: 1,
                color: C.blue,
                opacity: qO,
                transform: `scale(${qS})`,
              }}
            >
              ?
            </div>
          )}

          {/* Paquets, réticules, ondes */}
          <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <Reticle p={R1} f={f} at={142} out={190} />
            <Reticle p={R2} f={f} at={170} out={190} />
            {openS > 0 && <Packet p={[lx, Y]} s={openS * (f < 22 ? 1.6 : 1.2)} />}
            {f >= P1_T && f < CLICK && packetScale(f, P1_T) > 0 && <Packet p={p1At(f)} s={1.2 * packetScale(f, P1_T)} />}
            {f >= P2_T && f < TYPE && packetScale(f, P2_T) > 0 && <Packet p={p2At(f)} s={1.2 * packetScale(f, P2_T)} />}
            <Ripple at={CLICK} p={PC_BTN} f={f} />
            <Ripple at={TYPE} p={PC_FIELD} f={f} />
          </svg>
        </div>
      </Camera>

      {/* Kicker et titre ensemble, le titre entier dès 0,5 s */}
      {kickerO > 0 && (
        <AbsoluteFill style={{ padding: "56px 96px", opacity: kickerO }}>
          <Words
            text="Agent H et pont holo local desktop"
            start={-12}
            f={f}
            style={{ fontSize: 28, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.kicker }}
          />
        </AbsoluteFill>
      )}
      {titleO > 0 && (
        <AbsoluteFill style={{ padding: "100px 96px", opacity: titleO }}>
          <Words text="2. Holo agit sur le PC" start={-12} f={f} style={{ fontSize: 88, fontWeight: 600, color: theme.ink }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
