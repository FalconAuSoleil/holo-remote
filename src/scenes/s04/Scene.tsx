import { Bot, Globe, Link, Wrench } from "lucide-react";
import { evolvePath } from "@remotion/paths";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp, keyframes } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Palette du site HoloRemote : accent unique bleu, cartes ardoise, texte blanc.
const C = {
  bgTop: "#8692FF",
  bgBottom: "#D3DAFF",
  accent: "#3B82F6",
  slate: "#5660A7",
  light: "#DCE1FF",
  ink: "#FFFFFF",
  inkSoft: "#EEF0FF",
};

const cubicInOut = Easing.inOut(Easing.cubic);
const cubicOut = Easing.out(Easing.cubic);
const cubicIn = Easing.in(Easing.cubic);
const sineInOut = Easing.inOut(Easing.sin);
const backOut = Easing.out(Easing.back(1.6));

const p = (f: number, start: number, dur: number, easing = cubicOut) =>
  interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing });

// Monde : Holo à gauche, le trou sur la ligne, la bretelle qui descend vers web_research,
// file vers Linkup, puis la rampe de retour qui remonte de Linkup jusqu'à la ligne.
const HOLO = { x: 960, y: 600, size: 240 };
const GAP = { x: 1560, y: 600, w: 580, h: 180 };
const GAP_LEFT = GAP.x - GAP.w / 2; // 1270
const GAP_RIGHT = GAP.x + GAP.w / 2; // 1850
const TOOL = { x: 1560, y: 1180, w: 680, h: 200 };
const LINKUP = { x: 2500, y: 1180, w: 440, h: 220 };

// Bretelle : du bas du trou vers l'outil, puis de l'outil vers Linkup.
const SEG1 = { x: GAP.x, y0: GAP.y + GAP.h / 2, y1: TOOL.y - TOOL.h / 2 };
const SEG2 = { y: TOOL.y, x0: TOOL.x + TOOL.w / 2, x1: LINKUP.x - LINKUP.w / 2 };

// Carte « Réponse sourcée » : naît au-dessus de Linkup, sans toucher la case outil.
const BIRTH = { x: LINKUP.x, y: 860 };
const LINKUP_TOP = LINKUP.y - LINKUP.h / 2; // 1070
const CARD_BOTTOM_AT_BIRTH = BIRTH.y + GAP.h / 2; // 950

// La ligne qui repart, puis file vers le haut (vers le téléphone de la séquence suivante).
const OUT_PATH = `M ${GAP_RIGHT} 600 L 2750 600 Q 3000 600 3000 350 L 3000 -900`;

// Retour de la carte : elle remonte la rampe au-dessus de Linkup, puis glisse dans le trou.
const RET_V = BIRTH.y - GAP.y; // 260
const RET_H = BIRTH.x - GAP.x; // 940
const RET_START = 198;
const RET_DUR = 56;
const LAND = RET_START + RET_DUR; // 254
const cardPos = (f: number) => {
  const d = interpolate(f, [RET_START, LAND], [0, RET_V + RET_H], { ...clamp, easing: sineInOut });
  if (d <= RET_V) return { x: BIRTH.x, y: BIRTH.y - d };
  return { x: BIRTH.x - (d - RET_V), y: GAP.y };
};

// Texte mot par mot : 3 frames de décalage, montée de 16 px, fondu en 12 frames.
const Words = ({
  text,
  start,
  frame,
  style,
  center = false,
}: {
  text: string;
  start: number;
  frame: number;
  style?: React.CSSProperties;
  center?: boolean;
}) => (
  <div style={{ display: "flex", flexWrap: "nowrap", columnGap: "0.26em", justifyContent: center ? "center" : "flex-start", ...style }}>
    {text.split(" ").map((w, i) => {
      const k = p(frame, start + i * 3, 12);
      return (
        <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * 16}px)`, whiteSpace: "nowrap" }}>
          {w}
        </span>
      );
    })}
  </div>
);

// Case ardoise : entrée en échelle 0,85 → 1 et fondu en 15 frames.
const Box = ({
  cx,
  cy,
  w,
  h,
  appear,
  frame,
  extraScale = 1,
  children,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  appear: number;
  frame: number;
  extraScale?: number;
  children?: React.ReactNode;
}) => {
  const k = interpolate(frame, [appear, appear + 15], [0, 1], { ...clamp, easing: backOut });
  const o = p(frame, appear, 15);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 40,
        backgroundColor: C.slate,
        border: `4px solid ${C.accent}`,
        opacity: o,
        transform: `scale(${(0.85 + 0.15 * k) * extraScale})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      {children}
    </div>
  );
};

const pulse = (f: number, start: number, end: number) => {
  if (f < start || f > end) return 1;
  const t = ((f - start) % 30) / 30;
  return 1 + 0.08 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
};

export const Scene = () => {
  const frame = useCurrentFrame();

  // --- Caméra : ouverture serrée sur le trou, descente le long de la bretelle, travelling vers Linkup,
  // suivi de la carte, puis recul final sur la ligne qui repart.
  // Cadrages choisis pour que les cases outil et Linkup soient soit entières, soit hors champ.
  const A = {
    x: keyframes(frame, [[0, 960], [22, 1360], [58, 1380], [100, 1300], [120, 1320], [160, 2160], [178, 2720], [196, 2730], [250, 1700], [262, 1700], [296, 1980]], cubicInOut),
    y: keyframes(frame, [[0, 540], [22, 580], [58, 590], [100, 1140], [120, 1140], [160, 1140], [178, 1000], [196, 1000], [250, 800], [262, 800], [296, 720]], cubicInOut),
    zoom: keyframes(frame, [[0, 1], [22, 1.45], [58, 1.48], [100, 1], [120, 1], [160, 1], [178, 1.2], [196, 1.22], [250, 0.9], [262, 0.9], [296, 0.75]], cubicInOut),
  };
  // Suivi de la carte avec 6 frames de retard, borné pour garder outil et Linkup entiers dans le cadre.
  const lag = cardPos(frame - 6);
  const F = { x: Math.min(2260, Math.max(1700, lag.x)), y: 800, zoom: 0.9 };
  const w = keyframes(frame, [[190, 0], [202, 1], [244, 1], [256, 0]], cubicInOut);
  const drift = 1 + 0.03 * (frame / (DURATION - 1));
  const cam = {
    x: A.x + (F.x - A.x) * w,
    y: A.y + (F.y - A.y) * w,
    zoom: (A.zoom + (F.zoom - A.zoom) * w) * drift,
  };

  // --- Plan 1 : la ligne repart et bute sur le trou.
  const lineTip = interpolate(frame, [3, 22], [HOLO.x + HOLO.size / 2, GAP_LEFT], { ...clamp, easing: cubicInOut });
  const gapIn = p(frame, 4, 10);
  const qMove = p(frame, 6, 22, cubicInOut);
  const qX = interpolate(qMove, [0, 1], [HOLO.x, GAP.x]);
  const qY = interpolate(qMove, [0, 1], [380, GAP.y]);
  const qSize = interpolate(qMove, [0, 1], [140, 120]);
  const qOut = 1 - p(frame, 244, 10, cubicIn);
  // Le libellé sort avant l'arrivée du kicker (au plus 8 mots à l'écran).
  const needOut = 1 - p(frame, 52, 10, cubicIn);

  // Kicker (plan 1) puis titre (plans 2 et 3), jamais ensemble, en haut comme dans tout le film.
  const kickerO = frame >= 4 ? 1 - p(frame, 52, 10, cubicIn) : 0;
  const titleO = p(frame, 62, 10) * (1 - p(frame, 188, 10, cubicIn));

  // Plan 3 : des pages web convergent vers Linkup.
  const particles = new Array(10).fill(0).map((_, i) => {
    const start = 140 + i * 3;
    const t = interpolate(frame, [start, start + 26], [0, 1], { ...clamp, easing: sineInOut });
    const ang = -Math.PI * 0.75 + random(`page-a-${i}`) * Math.PI * 1.5;
    const r = 520 + random(`page-r-${i}`) * 160;
    const o = frame < start ? 0 : interpolate(t, [0, 0.15, 0.8, 1], [0, 1, 1, 0], clamp);
    return {
      x: LINKUP.x + Math.cos(ang) * r * (1 - t),
      y: LINKUP.y + Math.sin(ang) * r * (1 - t) * 0.7,
      s: 1 - 0.5 * t,
      o,
    };
  });

  // --- Plans 2 et 3 : la bretelle se trace.
  const s1 = p(frame, 58, 24, cubicInOut);
  const s1Head = p(frame, 80, 4);
  const s1End = SEG1.y0 + (SEG1.y1 - 20 - SEG1.y0) * s1;
  const s2 = p(frame, 118, 20, cubicInOut);
  const s2Head = p(frame, 136, 4);
  const s2End = SEG2.x0 + (SEG2.x1 - 20 - SEG2.x0) * s2;

  // Linkup « cherche » : une pulsation, seule animation du plan avec le zoom.
  const linkupPulse = pulse(frame, 150, 180);

  // --- Plan 4 : la carte sourcée naît au-dessus de Linkup, la flèche va de Linkup vers la carte.
  const ramp = p(frame, 178, 18, cubicInOut);
  const card = cardPos(frame);
  const rampTop =
    frame < RET_START
      ? LINKUP_TOP - (LINKUP_TOP - (CARD_BOTTOM_AT_BIRTH + 20)) * ramp
      : card.x < BIRTH.x
        ? GAP.y
        : Math.max(GAP.y, Math.min(CARD_BOTTOM_AT_BIRTH + 20, card.y + GAP.h / 2));
  const rampHead = frame >= 194 && frame <= 214 ? p(frame, 194, 4) : 0;
  const cardK = interpolate(frame, [186, 201], [0, 1], { ...clamp, easing: backOut });
  const cardO = p(frame, 186, 12);
  const chipK = interpolate(frame, [194, 209], [0, 1], { ...clamp, easing: backOut });
  const landPulse = frame >= LAND && frame <= LAND + 30 ? pulse(frame, LAND, LAND + 30) : 1;
  const sealed = p(frame, LAND, 8);
  const cardScale = (0.4 + 0.6 * cardK) * (frame >= LAND ? 1 + (landPulse - 1) * 0.5 : 1);
  // La pièce posée garde son libellé jusqu'à la fin : le recul réduit la carte entière.
  const cardTextO = 1;

  // --- Plan 5 : la ligne de Holo repart.
  const outK = p(frame, 256, 32, cubicInOut);
  const out = evolvePath(outK, OUT_PATH);
  const holoPulse = pulse(frame, LAND, LAND + 30);

  const label: React.CSSProperties = { fontSize: 48, fontWeight: 500, color: theme.ink, lineHeight: 1.1 };
  // Bretelle : flèche neutre blanche, distincte de la ligne de tâche bleue de Holo.
  const ramp_c = C.ink;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`, fontFamily: theme.font }}>
      <Camera x={cam.x} y={cam.y} zoom={cam.zoom}>
        {/* Tracés */}
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {/* Ligne de tâche de Holo, venue de la séquence précédente */}
          <line x1={-3200} y1={600} x2={HOLO.x - HOLO.size / 2} y2={600} stroke={C.accent} strokeWidth={8} />
          {lineTip > HOLO.x + HOLO.size / 2 + 1 && (
            <line x1={HOLO.x + HOLO.size / 2} y1={600} x2={lineTip} y2={600} stroke={C.accent} strokeWidth={8} />
          )}
          {/* Trou en pointillés */}
          <rect
            x={GAP_LEFT}
            y={GAP.y - GAP.h / 2}
            width={GAP.w}
            height={GAP.h}
            rx={40}
            fill="none"
            stroke={C.ink}
            strokeWidth={5}
            strokeDasharray="20 16"
            strokeLinecap="round"
            opacity={gapIn * (1 - sealed)}
          />
          {/* Bretelle vers web_research */}
          {s1 > 0 && (
            <line x1={SEG1.x} y1={SEG1.y0} x2={SEG1.x} y2={s1End} stroke={ramp_c} strokeWidth={6} strokeLinecap="round" />
          )}
          <polygon
            points={`${SEG1.x - 10},${SEG1.y1 - 20} ${SEG1.x + 10},${SEG1.y1 - 20} ${SEG1.x},${SEG1.y1}`}
            fill={ramp_c}
            opacity={s1Head}
          />
          {/* Bretelle vers Linkup */}
          {s2 > 0 && <line x1={SEG2.x0} y1={SEG2.y} x2={s2End} y2={SEG2.y} stroke={ramp_c} strokeWidth={6} strokeLinecap="round" />}
          <polygon
            points={`${SEG2.x1 - 20},${SEG2.y - 10} ${SEG2.x1 - 20},${SEG2.y + 10} ${SEG2.x1},${SEG2.y}`}
            fill={ramp_c}
            opacity={s2Head}
          />
          {/* Rampe de retour : de Linkup vers la carte, puis jusqu'à la ligne */}
          {ramp > 0 && (
            <line x1={BIRTH.x} y1={LINKUP_TOP} x2={BIRTH.x} y2={rampTop} stroke={ramp_c} strokeWidth={6} strokeLinecap="round" />
          )}
          <polygon
            points={`${BIRTH.x - 10},${CARD_BOTTOM_AT_BIRTH + 20} ${BIRTH.x + 10},${CARD_BOTTOM_AT_BIRTH + 20} ${BIRTH.x},${CARD_BOTTOM_AT_BIRTH}`}
            fill={ramp_c}
            opacity={rampHead}
          />
          {/* Pages web qui convergent vers Linkup */}
          {particles.map((q, i) =>
            q.o > 0 ? (
              <g key={i} transform={`translate(${q.x} ${q.y}) scale(${q.s})`} opacity={q.o}>
                <rect x={-26} y={-34} width={52} height={68} rx={10} fill={C.light} stroke={C.accent} strokeWidth={4} />
                <line x1={-14} y1={-14} x2={14} y2={-14} stroke={C.accent} strokeWidth={4} strokeLinecap="round" />
                <line x1={-14} y1={0} x2={14} y2={0} stroke={C.accent} strokeWidth={4} strokeLinecap="round" />
                <line x1={-14} y1={14} x2={6} y2={14} stroke={C.accent} strokeWidth={4} strokeLinecap="round" />
              </g>
            ) : null,
          )}
          {/* La ligne qui repart et file vers le haut */}
          {outK > 0 && (
            <path
              d={OUT_PATH}
              fill="none"
              stroke={C.accent}
              strokeWidth={8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={out.strokeDasharray}
              strokeDashoffset={out.strokeDashoffset}
            />
          )}
        </svg>

        {/* Case Holo, état de raccord (rayon 32 px imposé par le raccord) */}
        <div
          style={{
            position: "absolute",
            left: HOLO.x - HOLO.size / 2,
            top: HOLO.y - HOLO.size / 2,
            width: HOLO.size,
            height: HOLO.size,
            boxSizing: "border-box",
            borderRadius: 32,
            backgroundColor: C.slate,
            border: `4px solid ${C.accent}`,
            transform: `scale(${holoPulse})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bot size={112} color={C.accent} strokeWidth={3} absoluteStrokeWidth />
        </div>

        {/* Le point d'interrogation quitte Holo et vient se loger dans le trou */}
        <div
          style={{
            position: "absolute",
            left: qX,
            top: qY,
            transform: `translate(-50%, -50%) scale(${frame >= 34 ? pulse(frame, 34, 244) : 1})`,
            fontSize: qSize,
            fontWeight: 700,
            lineHeight: 1,
            color: C.accent,
            opacity: qOut,
          }}
        >
          ?
        </div>

        {/* Libellé du manque, posé au-dessus du trou dès l'ouverture */}
        <div style={{ position: "absolute", left: GAP.x - 500, top: 404, width: 1000, opacity: needOut }}>
          <Words text="Holo a besoin d'une info" start={3} frame={frame} center style={label} />
        </div>

        {/* Outil web_research */}
        <Box cx={TOOL.x} cy={TOOL.y} w={TOOL.w} h={TOOL.h} appear={80} frame={frame}>
          <Wrench size={84} color={C.accent} strokeWidth={3} absoluteStrokeWidth />
          <Words text="Outil web_research" start={86} frame={frame} style={label} />
        </Box>

        {/* Linkup */}
        <Box cx={LINKUP.x} cy={LINKUP.y} w={LINKUP.w} h={LINKUP.h} appear={134} frame={frame} extraScale={linkupPulse}>
          <Globe size={96} color={C.accent} strokeWidth={3} absoluteStrokeWidth />
          <Words text="Linkup" start={140} frame={frame} style={{ ...label, fontWeight: 600 }} />
        </Box>

        {/* Carte « Réponse sourcée » : naît au-dessus de Linkup, remonte la rampe, comble le trou */}
        {frame >= 186 && (
          <div
            style={{
              position: "absolute",
              left: card.x - GAP.w / 2,
              top: card.y - GAP.h / 2,
              width: GAP.w,
              height: GAP.h,
              boxSizing: "border-box",
              borderRadius: 40,
              backgroundColor: C.slate,
              border: `${4 + 4 * sealed}px solid ${C.accent}`,
              opacity: cardO,
              transform: `scale(${cardScale})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: C.light,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${chipK})`,
              }}
            >
              <Link size={48} color={C.accent} strokeWidth={3} absoluteStrokeWidth />
            </div>
            <div style={{ opacity: cardTextO }}>
              <Words text="Réponse sourcée" start={192} frame={frame} style={label} />
            </div>
          </div>
        )}

        {/* Libellé de reprise, au-dessus de la ligne qui repart */}
        <div style={{ position: "absolute", left: 1960, top: 436, width: 900 }}>
          <Words text="Holo poursuit sa tâche" start={258} frame={frame} style={{ ...label, fontSize: 56 }} />
        </div>
      </Camera>

      {/* Kicker (plan 1) : texte libre en haut, écriture commune au film */}
      {kickerO > 0 && (
        <AbsoluteFill style={{ padding: "110px 96px", opacity: kickerO }}>
          <Words
            text="Un outil que Holo appelle"
            start={4}
            frame={frame}
            style={{ fontSize: 28, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}
          />
        </AbsoluteFill>
      )}

      {/* Titre (plans 2 et 3) : même emplacement, prend le relais du kicker */}
      {titleO > 0 && (
        <AbsoluteFill style={{ padding: "100px 96px", opacity: titleO }}>
          <Words text="3. Recherche web : Linkup" start={64} frame={frame} style={{ fontSize: 88, fontWeight: 600, color: C.ink }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
