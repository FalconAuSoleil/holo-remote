import { AudioLines, Eye, Globe, Keyboard, Monitor, MousePointerClick, OctagonX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Camera } from "../../../../bricks/Camera";
import { clamp, keyframes } from "../../../../bricks/motion";
import { theme } from "../../theme";

export const DURATION = 300;

// Palette du site HoloRemote : un seul accent bleu, cartes ardoise, remplissages clairs.
const C = {
  bgTop: "#8692FF",
  bgBottom: "#D3DAFF",
  accent: "#3B82F6",
  slate: "#5660A7",
  light: "#DCE1FF",
  frozen: "#B7BEFF",
  arrow: "#FFFFFF",
};

const IN_OUT = Easing.inOut(Easing.cubic);
const OUT_CUBIC = Easing.out(Easing.cubic);
const IN_CUBIC = Easing.in(Easing.cubic);
const BACK = Easing.out(Easing.back(1.4));
const SINE = Easing.inOut(Easing.sin);

const prog = (f: number, start: number, dur: number, easing: (t: number) => number = OUT_CUBIC) =>
  interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing });
const exitOp = (f: number, start: number) => 1 - prog(f, start, 10, IN_CUBIC);

// Géométrie du monde (5760 x 3240).
const ROW = 1500;
const PX = 1080; // téléphone
const PHONE = { w: 340, h: 600 };
const PTOP = ROW - PHONE.h / 2;
const STOP = { x: PX, y: PTOP + 530, w: 280, h: 84 };
const BW = 340;
const BH = 260;
const BUS_TOP = ROW - 420;
const LINK_Y = ROW + 520;

type BoxDef = { key: string; x: number; y: number; label: string; Icon: LucideIcon; pop: number };
const GLADIA: BoxDef = { key: "g", x: 2000, y: ROW, label: "Gladia", Icon: AudioLines, pop: 116 };
const HOLO: BoxDef = { key: "h", x: 2800, y: ROW, label: "Holo", Icon: Eye, pop: 130 };
const LINKUP: BoxDef = { key: "l", x: 2800, y: LINK_Y, label: "Linkup", Icon: Globe, pop: 144 };
const PC: BoxDef = { key: "p", x: 3600, y: ROW, label: "PC", Icon: Monitor, pop: 146 };
const BOXES = [GLADIA, HOLO, LINKUP, PC];

// Horaire.
const T = {
  title: 12,
  titleOut: 62,
  feedLabel: 74,
  feedLabelOut: 112,
  pulse: 166,
  stopLabel: 186,
  press: 200,
  stopLabelOut: 222,
  hero: 252,
  dots: 262,
  fade: 280,
};

// Temps du flux : vitesse 1, puis décélération jusqu'à l'arrêt après l'appui.
const DECEL = 24;
const flowTime = (f: number) => {
  if (f <= T.press) return f;
  const u = Math.min(1, (f - T.press) / DECEL);
  return T.press + DECEL * (u - (u * u) / 2);
};

type Pt = [number, number];
const lengths = (pts: Pt[]) => {
  const segs: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    segs.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return segs;
};
const along = (pts: Pt[], t: number): Pt => {
  const segs = lengths(pts);
  const total = segs.reduce((s, v) => s + v, 0);
  let d = t * total;
  for (let i = 0; i < segs.length; i++) {
    const L = segs[i]!;
    if (d <= L || i === segs.length - 1) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const k = L === 0 ? 0 : Math.min(1, d / L);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= L;
  }
  return pts[pts.length - 1]!;
};

// Flèches : la chaîne aller, puis le retour unique par le haut vers le téléphone.
type ArrowDef = { pts: Pt[]; start: number; dur: number; head: boolean };
const FWD: ArrowDef[] = [
  { pts: [[PX + PHONE.w / 2 + 14, ROW], [GLADIA.x - BW / 2 - 18, ROW]], start: 100, dur: 22, head: true },
  { pts: [[GLADIA.x + BW / 2 + 14, ROW], [HOLO.x - BW / 2 - 18, ROW]], start: 120, dur: 20, head: true },
  { pts: [[HOLO.x, ROW + BH / 2 + 14], [LINKUP.x, LINK_Y - BH / 2 - 18]], start: 134, dur: 18, head: true },
  { pts: [[HOLO.x + BW / 2 + 14, ROW], [PC.x - BW / 2 - 18, ROW]], start: 136, dur: 20, head: true },
];
const routeTop = (x: number): Pt[] => [[x, ROW - BH / 2 - 14], [x, BUS_TOP], [PX, BUS_TOP], [PX, PTOP - 18]];
const RET: ArrowDef[] = [
  { pts: routeTop(PC.x), start: 150, dur: 22, head: true },
  { pts: [[GLADIA.x, ROW - BH / 2 - 14], [GLADIA.x, BUS_TOP]], start: 156, dur: 14, head: false },
  { pts: [[HOLO.x, ROW - BH / 2 - 14], [HOLO.x, BUS_TOP]], start: 158, dur: 14, head: false },
];

// Peu de paquets : un par trajet à la fois, tous bleus.
type Stream = { pts: Pt[]; first: number; gap: number; travel: number };
const FWD_PATH: Pt[] = [[PX + PHONE.w / 2 + 14, ROW], [PC.x - BW / 2 - 18, ROW]];
const LINK_UP: Pt[] = [[LINKUP.x, LINK_Y - BH / 2 - 18], [HOLO.x, ROW + BH / 2 + 14]];
const STREAMS: Stream[] = [
  { pts: FWD_PATH, first: 124, gap: 40, travel: 40 },
  { pts: LINK_UP, first: 156, gap: 40, travel: 20 },
  { pts: routeTop(PC.x), first: 168, gap: 36, travel: 36 },
  { pts: routeTop(HOLO.x), first: 180, gap: 40, travel: 30 },
  { pts: routeTop(GLADIA.x), first: 174, gap: 40, travel: 24 },
];

// Fil du téléphone : une capture ou une action par créneau.
const SLOT = 140;
const SLOT_T = 30;
const FEED_TOP = 40;
const FEED_BOT = 470;

// Caméra : gros plan sur Stop, recul jusqu'à la chaîne entière, plongée vers le téléphone,
// puis recul qui laisse la place au logo au-dessus de la chaîne.
const camAt = (f: number) => {
  const x = keyframes(
    f,
    [
      [0, 740],
      [100, 700],
      [160, 2340],
      [168, 2340],
      [200, 940],
      [224, 940],
      [256, 2340],
    ],
    IN_OUT,
  );
  const y = keyframes(
    f,
    [
      [0, ROW + 40],
      [100, ROW + 40],
      [160, 1610],
      [168, 1610],
      [200, ROW + 60],
      [224, ROW + 60],
      [256, 1360],
    ],
    IN_OUT,
  );
  const z = keyframes(
    f,
    [
      [0, 1.6],
      [100, 1.0],
      [160, 0.6],
      [168, 0.6],
      [200, 1.1],
      [224, 1.1],
      [256, 0.6],
      [299, 0.624],
    ],
    IN_OUT,
  );
  // Secousse de 4 px sur 6 frames à l'appui.
  const s = f >= T.press && f < T.press + 6 ? 4 * Math.sin((f - T.press) * 2.4) * (1 - (f - T.press) / 6) : 0;
  return { x: x - s / z, y, z };
};

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

const Box = ({ b, frame }: { b: BoxDef; frame: number }) => {
  const s = prog(frame, b.pop, 15, BACK);
  const o = prog(frame, b.pop, 15);
  return (
    <div
      style={{
        position: "absolute",
        left: b.x - BW / 2,
        top: b.y - BH / 2,
        width: BW,
        height: BH,
        borderRadius: 48,
        backgroundColor: C.slate,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        opacity: o,
        transform: `scale(${0.85 + 0.15 * s})`,
      }}
    >
      <div style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: C.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <b.Icon size={68} color={C.accent} strokeWidth={3} />
      </div>
      <span style={{ fontSize: 56, fontWeight: 500, color: theme.ink }}>{b.label}</span>
    </div>
  );
};

const Arrow = ({ a, frame, gray }: { a: ArrowDef; frame: number; gray: number }) => {
  const p = prog(frame, a.start, a.dur, IN_OUT);
  if (p <= 0) return null;
  const total = lengths(a.pts).reduce((s, v) => s + v, 0);
  const color = interpolateColors(gray, [0, 1], [C.arrow, C.frozen]);
  const end = a.pts[a.pts.length - 1]!;
  const prev = a.pts[a.pts.length - 2]!;
  const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const hp = prog(frame, a.start + a.dur - 4, 6);
  const H = 34;
  const hx = (dx: number, dy: number) => end[0] + dx * Math.cos(ang) - dy * Math.sin(ang);
  const hy = (dx: number, dy: number) => end[1] + dx * Math.sin(ang) + dy * Math.cos(ang);
  return (
    <g>
      <polyline
        points={a.pts.map((q) => q.join(",")).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${total} ${total}`}
        strokeDashoffset={total * (1 - p)}
      />
      {a.head && hp > 0 && (
        <polygon
          points={`${hx(0, 0)},${hy(0, 0)} ${hx(-H, -H * 0.6)},${hy(-H, -H * 0.6)} ${hx(-H, H * 0.6)},${hy(-H, H * 0.6)}`}
          fill={color}
          strokeLinejoin="round"
          stroke={color}
          strokeWidth={6}
          opacity={hp}
        />
      )}
    </g>
  );
};

// Élément du fil : capture d'écran (carte ardoise) ou action (pastille bleue).
const FeedItem = ({ i }: { i: number }) => {
  const kind = ((i % 3) + 3) % 3;
  if (kind === 2) {
    const Icon = ((i % 2) + 2) % 2 === 0 ? MousePointerClick : Keyboard;
    return (
      <div style={{ width: 150, height: 80, borderRadius: 40, backgroundColor: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={46} color={theme.ink} strokeWidth={3} />
      </div>
    );
  }
  return (
    <div style={{ width: 280, height: 116, borderRadius: 32, backgroundColor: C.slate, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Monitor size={56} color={theme.ink} strokeWidth={3} />
    </div>
  );
};

// Libellé en pastille ardoise : lisible sur toute la hauteur du dégradé.
const pill: React.CSSProperties = {
  backgroundColor: C.slate,
  borderRadius: 48,
  padding: "22px 40px",
  fontSize: 48,
  fontWeight: 500,
  color: theme.ink,
};

export const Scene = () => {
  const frame = useCurrentFrame();
  const cam = camAt(frame);
  const ft = flowTime(frame);
  const grayPk = prog(frame, T.press + 2, 16);
  const grayAr = prog(frame, T.press + 6, 18);

  // Paquets.
  const packets: { x: number; y: number; key: string }[] = [];
  STREAMS.forEach((s, si) => {
    for (let k = 0; k < 6; k++) {
      const st = s.first + k * s.gap;
      const ph = (ft - st) / s.travel;
      if (ph <= 0 || ph >= 1) continue;
      const [x, y] = along(s.pts, SINE(ph));
      packets.push({ x, y, key: `${si}-${k}` });
    }
  });
  const packetColor = interpolateColors(grayPk, [0, 1], [C.accent, C.frozen]);

  // Fil du téléphone.
  const feed: { i: number; y: number }[] = [];
  for (let i = -6; i < 12; i++) {
    const y = FEED_BOT - SLOT - (ft - i * SLOT_T) * (SLOT / SLOT_T);
    if (y > FEED_TOP - SLOT && y < FEED_BOT) feed.push({ i, y });
  }

  // Bouton Stop : pulsation, appui.
  const pulsing = frame >= T.pulse && frame < T.press;
  const pulse = pulsing ? 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - T.pulse)) / 30)) : 0;
  const pressDip = interpolate(frame, [T.press, T.press + 3, T.press + 10], [0, 1, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const stopScale = 1 + pulse - 0.08 * pressDip;
  const halo = pulsing ? 0.3 + 0.6 * (pulse / 0.08) : 0;

  // Onde unique à l'appui.
  const wave = prog(frame, T.press, 20, OUT_CUBIC);
  const waveOn = frame >= T.press && wave < 1;

  const titleOp = exitOp(frame, T.titleOut);
  const feedLabelOp = frame >= T.feedLabel ? exitOp(frame, T.feedLabelOut) : 0;
  const stopLabelOp = frame >= T.stopLabel ? exitOp(frame, T.stopLabelOut) : 0;
  const fade = prog(frame, T.fade, 20, Easing.linear);
  // Pendant le fondu 5→6, le monde n'apparaît qu'en fin de fondu.
  const worldOp = prog(frame, 8, 14);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`, fontFamily: theme.font }}>
      <Camera x={cam.x} y={cam.y} zoom={cam.z}>
        <div style={{ position: "relative", width: 5760, height: 3240, opacity: worldOp }}>
          {/* Flèches et paquets, sous les boîtes */}
          <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {[...FWD, ...RET].map((a, i) => (
              <Arrow key={i} a={a} frame={frame} gray={grayAr} />
            ))}
            {packets.map((p) => (
              <circle key={p.key} cx={p.x} cy={p.y} r={24} fill={packetColor} />
            ))}
          </svg>

          {BOXES.map((b) => (
            <Box key={b.key} b={b} frame={frame} />
          ))}

          {/* Téléphone : cadre ardoise, écran clair */}
          <div
            style={{
              position: "absolute",
              left: PX - PHONE.w / 2,
              top: PTOP,
              width: PHONE.w,
              height: PHONE.h,
              borderRadius: 56,
              backgroundColor: C.slate,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                top: FEED_TOP,
                height: FEED_BOT - FEED_TOP,
                borderRadius: 36,
                backgroundColor: C.light,
                overflow: "hidden",
              }}
            >
              {feed.map(({ i, y }) => (
                <div key={i} style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", top: y - FEED_TOP + 12 }}>
                  <FeedItem i={i} />
                </div>
              ))}
            </div>
          </div>

          {/* Halo de pulsation et onde du Stop */}
          <svg width={5760} height={3240} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {halo > 0 && (
              <rect
                x={STOP.x - STOP.w / 2 - 16}
                y={STOP.y - STOP.h / 2 - 16}
                width={STOP.w + 32}
                height={STOP.h + 32}
                rx={(STOP.h + 32) / 2}
                fill="none"
                stroke={C.accent}
                strokeWidth={6}
                opacity={halo}
                transform={`translate(${STOP.x} ${STOP.y}) scale(${stopScale}) translate(${-STOP.x} ${-STOP.y})`}
              />
            )}
            {waveOn && <circle cx={STOP.x} cy={STOP.y} r={810 * wave} fill="none" stroke={C.accent} strokeWidth={8} opacity={1 - wave} />}
          </svg>
          <div
            style={{
              position: "absolute",
              left: STOP.x - STOP.w / 2,
              top: STOP.y - STOP.h / 2,
              width: STOP.w,
              height: STOP.h,
              borderRadius: STOP.h / 2,
              backgroundColor: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              transform: `scale(${stopScale})`,
            }}
          >
            <OctagonX size={52} color={theme.ink} strokeWidth={3} />
            <span style={{ fontSize: 44, fontWeight: 600, color: theme.ink }}>Stop</span>
          </div>
        </div>
      </Camera>

      {/* Plan 1 : titre */}
      {titleOp > 0 && (
        <AbsoluteFill style={{ padding: "120px 100px", opacity: titleOp }}>
          <Words
            text="5. Tu vois tout en direct"
            start={T.title}
            frame={frame}
            style={{ fontSize: 88, fontWeight: 600, color: theme.ink, width: 820, lineHeight: 1.1 }}
          />
        </AbsoluteFill>
      )}

      {/* Plan 2 : libellé du fil */}
      {feedLabelOp > 0 && (
        <div style={{ position: "absolute", left: 100, top: 440, width: 620, opacity: feedLabelOp }}>
          <div style={{ ...pill, display: "inline-block" }}>
            <Words text="Chaque action et chaque capture" start={T.feedLabel} frame={frame} style={{ lineHeight: 1.2 }} />
          </div>
        </div>
      )}

      {/* Plan 4 : le Stop */}
      {stopLabelOp > 0 && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 80, opacity: stopLabelOp }}>
          <div style={pill}>
            <Words text="Un bouton arrête l'agent à tout moment" start={T.stopLabel} frame={frame} style={{ flexWrap: "nowrap" }} />
          </div>
        </AbsoluteFill>
      )}

      {/* Plan 5 : titre du film et pastilles des quatre étapes */}
      {frame >= T.hero && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 50 }}>
          <Words text="HoloRemote" start={T.hero} frame={frame} style={{ fontSize: 160, fontWeight: 700, color: theme.ink, letterSpacing: "-0.02em" }} />
          <div style={{ display: "flex", gap: 28, marginTop: 6 }}>
            {[0, 1, 2, 3].map((i) => {
              const s = prog(frame, T.dots + i * 3, 15, BACK);
              return (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: C.accent,
                    opacity: prog(frame, T.dots + i * 3, 15),
                    transform: `scale(${0.85 + 0.15 * s})`,
                  }}
                />
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Fin du film : fondu au fond #8692FF */}
      {fade > 0 && <AbsoluteFill style={{ backgroundColor: C.bgTop, opacity: fade }} />}
    </AbsoluteFill>
  );
};
