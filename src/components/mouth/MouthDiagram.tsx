import { useId } from "react";
import { motion } from "framer-motion";
import {
  ARCH_ELLIPSE,
  ARCH_GUM_PATH,
  ARCH_TEETH,
  CAVITY_PATH,
  FULL_VIEWBOX,
  LIPS_PATH,
  LOWER_GUM_PATH,
  TONGUE,
  UPPER_GUM_PATH,
  VIEW_H,
  VIEW_W,
  brushPlan,
  brushPosition,
  isSurfaceShiny,
  spotlightWindow,
  stepInfo,
  targetIndices,
  teethOfArch,
  showsInside,
  zoomViewBox,
  type ArchTooth,
  type Box,
  type BrushPlan,
  type StepRef,
  type Tooth,
} from "./geometry";

const INK = "hsl(var(--ink))";
const MINT = "hsl(var(--mint))";
const SUN = "hsl(var(--sunshine))";
const LIP = "#FF8FA3";
const GUM = "#FFB3C1";
const PALATE = "#FFD9E1";
const CAVITY = "#6B2340";
const TONGUE_FILL = "#FF7A9A";
const MATTE = "#F2EBDD"; // not brushed yet
const SHINY = "#FFFFFF"; // brushed
const GLINT = "#A8E6FF";
const GLOW = "drop-shadow(0 0 5px hsl(var(--mint)))";

interface MouthDiagramProps {
  zoneIndex: number;
  phaseIndex: number;
  /** Seconds (fractional) spent in the current phase. */
  phaseElapsed: number;
  /** Session over: everything shines, sparkle wave, no spotlight. */
  finished?: boolean;
}

/**
 * The mouth for the current step: a spotlight on the teeth to brush, a brush that
 * travels across all of them, and teeth that go from matte to shiny as it passes.
 */
const MouthDiagram = ({ zoneIndex, phaseIndex, phaseElapsed, finished = false }: MouthDiagramProps) => {
  const step: StepRef = { zoneIndex, phaseIndex };
  const { view } = stepInfo(step);
  const drawing = finished ? "smile" : view === "top" ? "arch" : showsInside(view) ? "inside" : "smile";

  return (
    // Card flip whenever the drawing changes (outside ↔ inside ↔ top-down).
    <motion.div
      key={drawing}
      className="w-full max-w-[400px]"
      initial={{ rotateY: 90, opacity: 0.3 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{ transformPerspective: 800 }}
    >
      {drawing === "arch" ? (
        <ArchView step={step} phaseElapsed={phaseElapsed} />
      ) : (
        <SmileView step={step} phaseElapsed={phaseElapsed} finished={finished} />
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Smile view: front, inside and zoomed molar-side steps
// ---------------------------------------------------------------------------

const SmileView = ({ step, phaseElapsed, finished }: { step: StepRef; phaseElapsed: number; finished: boolean }) => {
  const clipId = useId();
  const { zone, view, arch } = stepInfo(step);
  const inside = showsInside(view) && !finished;
  const targets = finished ? [] : targetIndices(step);
  const plan = brushPlan(step);
  const brushAt = brushPosition(plan, phaseElapsed);
  const shiny = (t: Tooth) => isSurfaceShiny(t.arch, t.index, "outer", step, phaseElapsed, finished);
  const isTarget = (t: Tooth) => t.arch === arch && targets.includes(t.index);
  const archTeeth = teethOfArch(arch);
  const palateBox = inside ? boxAround(archTeeth) : null;

  return (
    <motion.svg
      viewBox={FULL_VIEWBOX}
      initial={{ viewBox: FULL_VIEWBOX }}
      animate={{ viewBox: finished ? FULL_VIEWBOX : zoomViewBox(step) }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="w-full h-auto drop-shadow-[0_8px_0_hsl(var(--ink)/0.12)]"
      role="img"
      aria-label={finished ? "Toutes les dents brillent" : `Bouche : ${zone.label}`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={CAVITY_PATH} />
        </clipPath>
      </defs>

      {/* Lips */}
      <path d={LIPS_PATH} fill={LIP} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M86,52 C112,44 138,42 166,42" fill="none" stroke="white" strokeOpacity={0.65} strokeWidth={6} strokeLinecap="round" />

      <g clipPath={`url(#${clipId})`}>
        <path d={CAVITY_PATH} fill={CAVITY} />
        <ellipse cx={TONGUE.cx} cy={TONGUE.cy} rx={TONGUE.rx} ry={TONGUE.ry} fill={TONGUE_FILL} stroke={INK} strokeWidth={2.5} opacity={0.8} />

        {/* Inner surfaces: pale palate behind see-through teeth, brush behind them */}
        {palateBox && <rect x={palateBox.x} y={palateBox.y} width={palateBox.w} height={palateBox.h} rx={14} fill={PALATE} />}
        {!finished && plan.layer === "back" && <AnimatedBrush plan={plan} at={brushAt} />}

        {/* Other teeth */}
        {[...teethOfArch("upper"), ...teethOfArch("lower")]
          .filter((t) => !isTarget(t))
          .map((t) => (
            <SmileTooth key={`${t.arch}-${t.index}`} tooth={t} shiny={shiny(t)} dim={!finished} />
          ))}

        {/* Targeted teeth: one "boing" when the step starts */}
        <motion.g
          key={`${step.zoneIndex}-${step.phaseIndex}`}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ filter: inside ? undefined : GLOW }}
        >
          {archTeeth.filter(isTarget).map((t) => (
            <SmileTooth key={t.index} tooth={t} shiny={shiny(t)} target seeThrough={inside} />
          ))}
        </motion.g>

        {/* Gums cover the tooth roots */}
        <path d={UPPER_GUM_PATH} fill={GUM} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <path d={LOWER_GUM_PATH} fill={GUM} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />

        {/* Sparkles: on target teeth as they get brushed, or a wave over all teeth at the end */}
        {finished
          ? [...teethOfArch("upper"), ...teethOfArch("lower")].map((t) => (
              <Sparkle key={`${t.arch}-${t.index}`} x={t.cx} y={t.cy} delay={(t.cx / VIEW_W) * 0.8} />
            ))
          : archTeeth
              .filter((t) => isTarget(t) && shiny(t) && !inside)
              .map((t) => <Sparkle key={t.index} x={t.cx + (t.x1 - t.x0) / 4} y={t.cy} delay={0} />)}
      </g>

      <path d={CAVITY_PATH} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />

      {!finished && (
        <>
          <Spotlight box={spotlightWindow(step)} clip={LIPS_PATH} />
          {plan.layer === "front" && <AnimatedBrush plan={plan} at={brushAt} />}
        </>
      )}
    </motion.svg>
  );
};

const SmileTooth = ({
  tooth,
  shiny,
  target = false,
  dim = false,
  seeThrough = false,
}: {
  tooth: Tooth;
  shiny: boolean;
  target?: boolean;
  dim?: boolean;
  seeThrough?: boolean;
}) => {
  const dir = tooth.tipY > tooth.gumY ? 1 : -1;
  return (
    <g opacity={dim ? 0.6 : 1}>
      <path
        d={tooth.d}
        fill={shiny ? SHINY : MATTE}
        fillOpacity={seeThrough ? 0.3 : 1}
        stroke={target ? MINT : INK}
        strokeWidth={target ? 4 : 2.5}
        strokeDasharray={seeThrough ? "5 4" : undefined}
        strokeLinejoin="round"
      />
      {shiny && !seeThrough && (
        <path
          d={`M${tooth.x0 + 4.5},${tooth.gumY + 6 * dir} L${tooth.x0 + 4.5},${tooth.gumY + 13 * dir}`}
          stroke={GLINT}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Top-down arch view: chewing surfaces of the molars
// ---------------------------------------------------------------------------

/** Outline of the gum band + inside of the arch (clips the veil in the top-down view). */
const ARCH_OUTLINE = (() => {
  const { cx, cy, rx, ry } = ARCH_ELLIPSE;
  const m = 30; // half the gum band + outline
  const cap = (x: number) => `M${x - m},${cy} a${m},${m} 0 1 0 ${2 * m},0 a${m},${m} 0 1 0 ${-2 * m},0 Z`;
  // Arch closed at its base line, plus round caps at both ends (nothing below the arch).
  return [`M${cx - rx - m},${cy} A${rx + m},${ry + m} 0 0 1 ${cx + rx + m},${cy} Z`, cap(cx - rx), cap(cx + rx)];
})();

const ArchView = ({ step, phaseElapsed }: { step: StepRef; phaseElapsed: number }) => {
  const { zone, arch } = stepInfo(step);
  const targets = targetIndices(step);
  const plan = brushPlan(step);
  const brushAt = brushPosition(plan, phaseElapsed);
  const shiny = (t: ArchTooth) => isSurfaceShiny(arch, t.index, "top", step, phaseElapsed);
  const { cx, cy, rx, ry } = ARCH_ELLIPSE;

  return (
    <svg
      viewBox={FULL_VIEWBOX}
      className="w-full h-auto drop-shadow-[0_8px_0_hsl(var(--ink)/0.12)]"
      role="img"
      aria-label={`Vue du dessus : ${zone.label}`}
    >
      {/* Inside the arch: palate (upper) or tongue (lower) */}
      <path d={`${ARCH_GUM_PATH} Z`} fill={arch === "upper" ? PALATE : CAVITY} />
      {arch === "lower" && (
        <ellipse cx={cx} cy={cy - 40} rx={rx - 48} ry={ry - 70} fill={TONGUE_FILL} stroke={INK} strokeWidth={2.5} opacity={0.8} />
      )}

      {/* Gum band */}
      <path d={ARCH_GUM_PATH} fill="none" stroke={INK} strokeWidth={58} strokeLinecap="round" />
      <path d={ARCH_GUM_PATH} fill="none" stroke={GUM} strokeWidth={52} strokeLinecap="round" />

      {ARCH_TEETH.filter((t) => !targets.includes(t.index)).map((t) => (
        <ArchCrown key={t.index} tooth={t} shiny={shiny(t)} dim />
      ))}
      <motion.g
        key={`${step.zoneIndex}-${step.phaseIndex}`}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ filter: GLOW }}
      >
        {ARCH_TEETH.filter((t) => targets.includes(t.index)).map((t) => (
          <ArchCrown key={t.index} tooth={t} shiny={shiny(t)} target />
        ))}
      </motion.g>
      {ARCH_TEETH.filter((t) => targets.includes(t.index) && shiny(t)).map((t) => (
        <Sparkle key={t.index} x={t.cx + t.size / 3} y={t.cy - t.size / 3} delay={0} />
      ))}

      <Spotlight box={spotlightWindow(step)} clip={ARCH_OUTLINE} />
      <AnimatedBrush plan={plan} at={brushAt} />
    </svg>
  );
};

/** Crown seen from above: molars are rounded squares with a "+" groove. */
const ArchCrown = ({ tooth, shiny, target = false, dim = false }: { tooth: ArchTooth; shiny: boolean; target?: boolean; dim?: boolean }) => {
  const s = tooth.size;
  const w = tooth.molar ? s : s * 1.1;
  const h = tooth.molar ? s : s * 0.55;
  const g = s / 3.2;
  return (
    <g transform={`translate(${tooth.cx},${tooth.cy}) rotate(${tooth.rotate})`} opacity={dim ? 0.6 : 1}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={tooth.molar ? s / 3.5 : h / 2}
        fill={shiny ? SHINY : MATTE}
        stroke={target ? MINT : INK}
        strokeWidth={target ? 4 : 2.5}
      />
      {tooth.molar && (
        <path d={`M${-g},0 L${g},0 M0,${-g} L0,${g}`} stroke={INK} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
      )}
      {shiny && <path d={`M${-w / 2 + 5},${-h / 2 + 5} L${-w / 2 + 10},${-h / 2 + 5}`} stroke={GLINT} strokeWidth={2.5} strokeLinecap="round" />}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function boxAround(teeth: Tooth[]): Box {
  const x0 = Math.min(...teeth.map((t) => t.x0)) - 4;
  const x1 = Math.max(...teeth.map((t) => t.x1)) + 4;
  const ys = teeth.flatMap((t) => [t.gumY, t.tipY]);
  const y0 = Math.min(...ys) - 6;
  const y1 = Math.max(...ys) + 6;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const SLIDE = { duration: 0.5, ease: "easeInOut" } as const;

/** Dark veil with a window on the targeted teeth, framed by four sunshine corners. */
const Spotlight = ({ box, clip }: { box: Box; clip: string | string[] }) => {
  const maskId = useId();
  const clipId = useId();
  const corners = [
    { x: box.x, y: box.y, d: "M0,16 L0,0 L16,0" },
    { x: box.x + box.w, y: box.y, d: "M-16,0 L0,0 L0,16" },
    { x: box.x, y: box.y + box.h, d: "M0,-16 L0,0 L16,0" },
    { x: box.x + box.w, y: box.y + box.h, d: "M-16,0 L0,0 L0,-16" },
  ];
  return (
    <g pointerEvents="none">
      <defs>
        {/* The veil only darkens the mouth itself, not the background around it. */}
        <clipPath id={clipId}>
          {/* Several shapes in a clipPath combine as a union. */}
          {(Array.isArray(clip) ? clip : [clip]).map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
        <mask id={maskId}>
          <rect x={-VIEW_W} y={-VIEW_H} width={VIEW_W * 3} height={VIEW_H * 3} fill="white" />
          {/* Rect drawn at 0,0 and moved with x/y (framer treats x/y as a translate on SVG). */}
          <motion.rect
            rx={16}
            fill="black"
            initial={false}
            animate={{ x: box.x, y: box.y, width: box.w, height: box.h }}
            transition={SLIDE}
          />
        </mask>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={-VIEW_W} y={-VIEW_H} width={VIEW_W * 3} height={VIEW_H * 3} fill={INK} fillOpacity={0.3} mask={`url(#${maskId})`} />
      </g>
      {corners.map((c, i) => (
        <motion.g key={i} initial={false} animate={{ x: c.x, y: c.y }} transition={SLIDE}>
          <path d={c.d} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <path d={c.d} fill="none" stroke={SUN} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      ))}
    </g>
  );
};

const SPARKLE_PATH = "M0,-6 L1.6,-1.6 L6,0 L1.6,1.6 L0,6 L-1.6,1.6 L-6,0 L-1.6,-1.6 Z";

const Sparkle = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <g transform={`translate(${x},${y})`}>
    <motion.path
      d={SPARKLE_PATH}
      fill={SUN}
      stroke={INK}
      strokeWidth={1}
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.3, 0.8, 1.1], opacity: [0, 1, 0.7, 1] }}
      transition={{ duration: 1.2, delay, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
    />
  </g>
);

const GESTURES: Record<BrushPlan["gesture"], { animate: Record<string, number[]>; duration: number }> = {
  circles: { animate: { x: [0, 5, 0, -5, 0], y: [-5, 0, 5, 0, -5] }, duration: 0.8 }, // gentle circles (front)
  "flick-down": { animate: { y: [0, 9, 0] }, duration: 0.5 }, // gum → tip, upper inner surfaces
  "flick-up": { animate: { y: [0, -9, 0] }, duration: 0.5 }, // gum → tip, lower inner surfaces
  scrub: { animate: { x: [-6, 6, -6] }, duration: 0.4 }, // back-and-forth, molar cheek side
  slide: { animate: { x: [-8, 8, -8] }, duration: 0.35 }, // flat back-and-forth on molar tops
};

/** Travels along the step's path (position driven by the session clock) and mimes the gesture. */
const AnimatedBrush = ({ plan, at }: { plan: BrushPlan; at: { x: number; y: number } }) => {
  const g = GESTURES[plan.gesture];
  return (
    <motion.g initial={false} animate={{ x: at.x, y: at.y }} transition={{ duration: 0.3, ease: "linear" }}>
      <motion.g key={plan.gesture} animate={g.animate} transition={{ duration: g.duration, repeat: Infinity, ease: "easeInOut" }}>
        <g transform={plan.orient}>
          <Toothbrush handle={plan.handle} />
        </g>
      </motion.g>
    </motion.g>
  );
};

/** Drawn horizontally: head at the origin, bristles pointing up, handle to the right. */
const Toothbrush = ({ handle }: { handle: number }) => (
  <g>
    {[-12, -7, -2, 3, 8, 13].map((bx) => (
      <rect key={bx} x={bx - 2} y={-12} width={4} height={11} rx={2} fill="#9FDDF0" stroke={INK} strokeWidth={1.5} />
    ))}
    <rect x={-16} y={-2} width={34} height={12} rx={5} fill="white" stroke={INK} strokeWidth={2.5} />
    <rect x={16} y={-1} width={handle} height={11} rx={5.5} fill={MINT} stroke={INK} strokeWidth={2.5} />
    {handle > 40 && <rect x={42} y={1.5} width={22} height={6} rx={3} fill={SUN} />}
  </g>
);

export default MouthDiagram;
