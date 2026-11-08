import { AudioLines, Bot, Monitor, Smartphone } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp, keyframes } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Courbes de la bible de style.
const cubicInOut = Easing.inOut(Easing.cubic);
const cubicOut = Easing.out(Easing.cubic);
const cubicIn = Easing.in(Easing.cubic);
const sineInOut = Easing.inOut(Easing.sin);
const quartOut = Easing.out(Easing.poly(4));
const backOut = Easing.out(Easing.back(1.3));
const linear = Easing.linear;

const p = (frame: number, start: number, dur: number, easing: (t: number) => number = cubicOut) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing });

// Fond bleu nuit uni. Chaque étape garde sa couleur sur tout le film :
// Téléphone cyan, Gladia violet, Holo ambre, PC vert. Fonds teintés à 18 % précalculés.
const BG = "#0B1230";
const INK_SOFT = "rgba(255,255,255,0.92)";
const COLORS = {
  phone: { stroke: "#22D3EE", fill: "#0F3552" },
  gladia: { stroke: "#A78BFA", fill: "#272854" },
  holo: { stroke: "#F59E0B", fill: "#352B29" },
  pc: { stroke: "#22C55E", fill: "#0F3238" },
} as const;
// Case PC une fois l'action faite : teinte verte plus franche.
const PC_DONE = "#11532E";
const ARROW = "#FFFFFF";

// Monde : la chaîne posée de gauche à droite sur une ligne.
const CY = 1620;
const BOX_W = 520;
const BOX_H = 420;
const ICON_Y = 1570;
const NAME_Y = 1735;

type Key = keyof typeof COLORS;
// Un libellé qui approche du bord du cadre s'efface : jamais de mot tronqué à l'écran.
const edgeFade = (worldX: number, worldW: number, cam: { x: number; zoom: number }) => {
  const sx = 960 + cam.zoom * (worldX - cam.x);
  const half = (cam.zoom * worldW) / 2;
  const margin = Math.min(sx - half, 1920 - (sx + half));
  return interpolate(margin, [0, 60], [0, 1], clamp);
};

// Largeurs approchées des noms et libellés, en px monde.
const NAME_W: Record<string, number> = { phone: 260, gladia: 160, holo: 130, pc: 80 };
const LABEL_W: Record<string, number> = { gladia: 540, holo: 300, pc: 270 };

const STATIONS: { key: Key; name: string; x: number; iconDX: number; Icon: typeof Smartphone; enter: number; label?: string; labelAt?: number; labelEnd?: number }[] = [
  { key: "phone", name: "Téléphone", x: 1550, iconDX: -100, Icon: Smartphone, enter: -8 },
  { key: "gladia", name: "Gladia", x: 2330, iconDX: 0, Icon: AudioLines, enter: 46, label: "Gladia : voix en texte", labelAt: 80, labelEnd: 112 },
  { key: "holo", name: "Holo", x: 3110, iconDX: -40, Icon: Bot, enter: 96, label: "Holo décide", labelAt: 124, labelEnd: 174 },
  { key: "pc", name: "PC", x: 3890, iconDX: 0, Icon: Monitor, enter: 140, label: "Le PC agit", labelAt: 186, labelEnd: 200 },
];

// Flèches entre les boîtes.
const A1 = { x1: 1830, x2: 2050 };
const A2 = { x1: 2610, x2: 2830 };
const A3 = { x1: 3390, x2: 3610 };

// Horaire.
const RECUL = 200;
const HOLD = 245;
const PLUNGE = 262;
const LAST = DURATION - 1;

// Onde sinusoïdale, visible seulement jusqu'à visMax (elle « entre » dans la boîte).
const wavePath = (x0: number, x1: number, visMax: number, y: number, amp: number, phase: number) => {
  const pts: string[] = [];
  const L = x1 - x0;
  const end = Math.min(x1, visMax);
  for (let x = x0; x <= end; x += 4) {
    const u = (x - x0) / L;
    const env = Math.sin(Math.PI * u);
    pts.push(`${x.toFixed(1)},${(y + amp * env * Math.sin(u * Math.PI * 6 + phase)).toFixed(1)}`);
  }
  return pts.length > 1 ? "M" + pts.join(" L") : "";
};

// Caméra de suivi : cible par clés, puis double lissage exponentiel (critique, sans dépassement, ~6 frames de retard).
const rawTarget = (f: number) => ({
  x: keyframes(
    f,
    [
      [0, 1550], [48, 1560], [74, 2070], [90, 2330], [96, 2360], [118, 3000],
      [132, 3110], [148, 3150], [176, 3800], [186, 3890], [RECUL, 3890],
    ],
    cubicInOut,
  ),
  y: keyframes(f, [[0, 1470], [48, 1470], [72, 1560], [RECUL, 1560]], cubicInOut),
  zoom: keyframes(f, [[0, 1.3], [48, 1.35], [72, 1.15], [176, 1.15], [188, 1.25], [RECUL, 1.25]], quartOut),
});

const followCam = (frame: number) => {
  const alpha = 1 - Math.exp(-1 / 3);
  let a = rawTarget(0);
  let b = rawTarget(0);
  const n = Math.max(0, Math.min(frame, RECUL));
  for (let i = 1; i <= n; i++) {
    const t = rawTarget(i);
    a = { x: a.x + (t.x - a.x) * alpha, y: a.y + (t.y - a.y) * alpha, zoom: a.zoom + (t.zoom - a.zoom) * alpha };
    b = { x: b.x + (a.x - b.x) * alpha, y: b.y + (a.y - b.y) * alpha, zoom: b.zoom + (a.zoom - b.zoom) * alpha };
  }
  return b;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixZoom = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

const OVERVIEW = { x: 2720, y: 1690 };
const FINAL = { x: 2330, y: CY, zoom: 1.6 };

const cameraAt = (frame: number) => {
  const f = followCam(frame);
  if (frame <= RECUL) return f;
  const r = p(frame, RECUL, HOLD - RECUL, cubicInOut);
  const holdZoom = 0.6 + 0.012 * p(frame, HOLD, PLUNGE - HOLD, linear);
  const recul = {
    x: mix(f.x, OVERVIEW.x, r),
    y: mix(f.y, OVERVIEW.y, r),
    zoom: r < 1 ? mixZoom(f.zoom, 0.6, r) : holdZoom,
  };
  if (frame <= PLUNGE) return recul;
  const k = interpolate(frame, [PLUNGE, LAST], [0, 1], { ...clamp, easing: cubicInOut });
  // La caméra se recentre d'abord sur Gladia, puis plonge : la case reste au centre pendant le zoom.
  const c = interpolate(frame, [PLUNGE, PLUNGE + 14], [0, 1], { ...clamp, easing: cubicInOut });
  return {
    x: mix(recul.x, FINAL.x, c),
    y: mix(recul.y, FINAL.y, c),
    zoom: mixZoom(recul.zoom, FINAL.zoom, k),
  };
};

// Texte mot par mot : 3 frames de décalage, montée de 16 px, 12 frames.
const Words = ({ text, start, frame, style }: { text: string; start: number; frame: number; style?: React.CSSProperties }) => (
  <div style={{ display: "flex", justifyContent: "center", columnGap: "0.28em", ...style }}>
    {text.split(" ").map((w, i) => {
      const t = p(frame, start + i * 3, 12, cubicOut);
      return (
        <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 16}px)` }}>
          {w}
        </span>
      );
    })}
  </div>
);

const Arrow = ({ x1, x2, end, opacity }: { x1: number; x2: number; end: number; opacity: number }) => {
  const e = Math.max(x1, Math.min(end, x2));
  const head = interpolate(e, [x2 - 12, x2], [0, 1], clamp);
  const lineEnd = Math.min(e, x2 - 14);
  return (
    <g opacity={opacity}>
      {e > x1 + 1 && <line x1={x1} x2={lineEnd} y1={CY} y2={CY} stroke={ARROW} strokeWidth={6} strokeLinecap="round" />}
      <polygon points={`${x2},${CY} ${x2 - 20},${CY - 12} ${x2 - 20},${CY + 12}`} fill={ARROW} opacity={head} />
    </g>
  );
};

export const Scene = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);

  const plungeK = interpolate(frame, [PLUNGE, LAST], [0, 1], { ...clamp, easing: cubicInOut });
  const othersOut = 1 - p(frame, PLUNGE, 12, cubicIn);
  const labelsOut = 1 - p(frame, RECUL, 10, cubicIn);

  // Onde cyan : pulse dans le téléphone, puis voyage vers Gladia.
  const waveIn = p(frame, 10, 14, cubicOut);
  const pulse30 = Math.sin((frame / 30) * Math.PI * 2);
  const head = interpolate(frame, [50, 86], [1740, 2250], { ...clamp, easing: sineInOut });
  const waveY = interpolate(frame, [50, 62], [ICON_Y, CY], { ...clamp, easing: cubicInOut });
  const waveAmp = (frame < 50 ? 24 + 10 * pulse30 : 26) * waveIn;
  const wave = wavePath(head - 180, head, 2070, waveY, waveAmp, frame * 0.35);

  // Mots violets (étiquettes à texte blanc) : sortent de Gladia et défilent jusque dans Holo.
  const hx = interpolate(frame, [84, 124], [2590, 3250], { ...clamp, easing: sineInOut });
  const PILLS = [
    { w: 210, t: "phrase" },
    { w: 120, t: "une" },
  ];
  const pillOffsets = [0, 210 + 18];

  // Curseur ambre : naît dans Holo, file vers l'écran du PC, clique.
  const cursorIn = p(frame, 118, 15, backOut);
  const cursorX = interpolate(frame, [150, 178], [3250, 3890], { ...clamp, easing: sineInOut });
  const cursorY = interpolate(frame, [150, 178], [1545, 1558], { ...clamp, easing: sineInOut });
  const clickS = interpolate(frame, [180, 183, 188], [1, 0.82, 1], clamp);
  const cursorOut = 1 - p(frame, 226, 10, cubicIn);
  const ripple = p(frame, 182, 20, cubicOut);
  const ripple2 = p(frame, 190, 20, cubicOut);
  const pcFill = interpolateColors(p(frame, 182, 10, cubicOut), [0, 1], [COLORS.pc.fill, PC_DONE]);

  // Titre et première ligne : tenus jusqu'à ce que la caméra les quitte, effacés avant le bord.
  const titleOut = (1 - p(frame, 66, 10, cubicIn)) * edgeFade(1550, 1000, cam);
  const subtitleOut = 1 - p(frame, 256, 10, cubicIn);
  // Les noms restent lisibles dans le plan large ; ils ne s'effacent qu'à la plongée finale.
  const namesOut = othersOut;

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: theme.font }}>
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        {/* Titre HoloRemote au-dessus du téléphone */}
        {titleOut > 0 && (
          <div
            style={{
              position: "absolute",
              left: 1550 - 600,
              top: 1150,
              width: 1200,
              display: "flex",
              justifyContent: "center",
              fontSize: 160,
              fontWeight: 700,
              color: theme.ink,
              lineHeight: 1,
              opacity: titleOut,
            }}
          >
            {"HoloRemote".split("").map((ch, i) => {
              const t = p(frame, 4 + i * 2, 12, cubicOut);
              return (
                <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 16}px)` }}>
                  {ch}
                </span>
              );
            })}
          </div>
        )}

        {/* Première ligne du deck, sous le titre */}
        {titleOut > 0 && (
          <Words
            text="Film de 50 secondes : 10 secondes par slide"
            start={8}
            frame={frame}
            style={{
              position: "absolute",
              left: 1550 - 600,
              top: 1326,
              width: 1200,
              fontSize: 36,
              fontWeight: 500,
              lineHeight: "44px",
              color: INK_SOFT,
              opacity: titleOut,
            }}
          />
        )}

        {/* Boîtes de la chaîne */}
        {STATIONS.map((s) => {
          const c = COLORS[s.key];
          const isGladia = s.key === "gladia";
          const ent = p(frame, s.enter, 15, backOut);
          const entO = p(frame, s.enter, 15, cubicOut);
          const scale = interpolate(ent, [0, 1], [0.85, 1]);
          const k = isGladia ? plungeK : 0;
          const w = mix(BOX_W, 1000, k);
          const h = mix(BOX_H, 500, k);
          const radius = mix(32, 30, k);
          const border = mix(4, 2.5, k);
          const iconSize = mix(140, 100, k);
          const sw = mix((3 * 24) / 140, 0.9, k);
          const iconX = s.x + s.iconDX;
          const iconY = mix(ICON_Y, CY, k);
          const pulseStart = s.key === "gladia" ? 74 : s.key === "holo" ? 112 : s.key === "pc" ? 180 : 20;
          const pulse = interpolate(frame, [pulseStart, pulseStart + 15, pulseStart + 30], [1, 1.08, 1], { ...clamp, easing: sineInOut });
          const opacity = entO * (isGladia ? 1 : othersOut);
          const nameO = namesOut * edgeFade(s.x, NAME_W[s.key]!, cam);
          const labelO = s.label
            ? labelsOut * (1 - p(frame, s.labelEnd!, 8, cubicIn)) * edgeFade(s.x, LABEL_W[s.key]!, cam)
            : 0;
          if (opacity <= 0) return null;
          return (
            <div
              key={s.key}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                opacity,
                transform: `scale(${scale})`,
                transformOrigin: `${s.x}px ${CY}px`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: s.x - w / 2,
                  top: CY - h / 2,
                  width: w,
                  height: h,
                  borderRadius: radius,
                  backgroundColor: s.key === "pc" ? pcFill : c.fill,
                  border: `${border}px solid ${c.stroke}`,
                  boxSizing: "border-box",
                }}
              />
              <s.Icon
                size={iconSize}
                strokeWidth={sw}
                color={c.stroke}
                style={{
                  position: "absolute",
                  left: iconX - iconSize / 2,
                  top: iconY - iconSize / 2,
                  transform: `scale(${pulse})`,
                }}
              />
              {nameO > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: s.x - 300,
                    top: NAME_Y - 30,
                    width: 600,
                    textAlign: "center",
                    fontSize: 48,
                    fontWeight: 500,
                    lineHeight: "60px",
                    color: theme.ink,
                    opacity: nameO,
                  }}
                >
                  {s.name}
                </div>
              )}
              {s.label && labelO > 0 && (
                <Words
                  text={s.label}
                  start={s.labelAt!}
                  frame={frame}
                  style={{
                    position: "absolute",
                    left: s.x - 500,
                    top: 1316,
                    width: 1000,
                    fontSize: 48,
                    fontWeight: 500,
                    lineHeight: "60px",
                    color: theme.ink,
                    opacity: labelO,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Flux : flèches, onde, mots, curseur, clic, paquets */}
        <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <clipPath id="s01-pills">
              <rect x={2590} y={1500} width={260} height={240} />
            </clipPath>
          </defs>

          <Arrow x1={A1.x1} x2={A1.x2} end={head} opacity={othersOut} />
          <Arrow x1={A2.x1} x2={A2.x2} end={hx} opacity={othersOut} />
          <Arrow x1={A3.x1} x2={A3.x2} end={frame >= 150 ? cursorX : A3.x1} opacity={othersOut} />

          {wave && frame < 90 && (
            <path d={wave} fill="none" stroke={COLORS.phone.stroke} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          )}

          {frame >= 86 && frame <= 124 && (
            <g clipPath="url(#s01-pills)">
              {PILLS.map((pl, i) => {
                const right = hx - pillOffsets[i]!;
                return (
                  <g key={i}>
                    <rect x={right - pl.w} y={CY - 32} width={pl.w} height={64} rx={32} fill={COLORS.gladia.stroke} />
                    <text
                      x={right - pl.w / 2}
                      y={CY + 12}
                      textAnchor="middle"
                      fontFamily={theme.font}
                      fontSize={36}
                      fontWeight={600}
                      fill="#FFFFFF"
                    >
                      {pl.t}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {frame >= 118 && cursorOut > 0 && (
            <g
              transform={`translate(${cursorX} ${cursorY}) scale(${cursorIn * clickS})`}
              opacity={Math.min(1, cursorIn) * cursorOut}
            >
              <path
                d="M0 0 L0 64 L17 49 L29 76 L41 71 L29 45 L50 45 Z"
                fill={COLORS.holo.stroke}
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </g>
          )}

          {frame >= 182 && frame < 202 && (
            <circle cx={3890} cy={1558} r={300 * ripple} fill="none" stroke={COLORS.pc.stroke} strokeWidth={6} opacity={1 - ripple} />
          )}
          {frame >= 190 && frame < 210 && (
            <circle cx={3890} cy={1558} r={300 * ripple2} fill="none" stroke={COLORS.pc.stroke} strokeWidth={6} opacity={1 - ripple2} />
          )}
        </svg>
      </Camera>

      {/* Sous-titre du plan large */}
      {frame >= 210 && subtitleOut > 0 && (
        <Words
          text="Une phrase dite au téléphone devient une action sur ton PC"
          start={212}
          frame={frame}
          style={{
            position: "absolute",
            left: 0,
            top: 790,
            width: 1920,
            fontSize: 48,
            fontWeight: 500,
            color: theme.ink,
            opacity: subtitleOut,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
