import { motion } from "framer-motion";

/**
 * Where the animation is: the tube slides in (arrive), squeezes a pea out of its nozzle (squeeze),
 * the pea drops on the bristles (drop), the tube leaves (leave). `idle` is the very start.
 */
export type TipStage = "idle" | "arrive" | "squeeze" | "drop" | "leave";

interface ToothpasteQuantityProps {
  stage: TipStage;
  /** Shows the oversized blob of paste instead of the pea (the « Trop ? » comparison). */
  blob: boolean;
  reduced: boolean;
}

// SVG elements scale around their own centre.
const CENTER = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** Where the pea rests on the bristles, and where the nozzle points above it. */
const PEA = { x: 246, y: 45 };
const NOZZLE = { x: 246, y: 14 };
/** Pea offsets relative to its resting place: just out of the nozzle, and hanging from it. */
const PEA_START = { x: 0, y: -31 };
const PEA_HANG = { x: -2.4, y: -17.2 };

const TUBE_AWAY = { x: 110, y: -110, opacity: 0 };
const TUBE_HERE = { x: 0, y: 0, opacity: 1 };

const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 38, y: Math.sin(angle) * 34 };
});

const INK = "stroke-ink";

/** The pea is a little oval, tilted: never a perfect circle. */
const Pea = () => (
  <g transform="rotate(-8)">
    <ellipse cx="0" cy="0" rx="17" ry="13.5" className={`fill-white ${INK}`} strokeWidth="3" />
    <ellipse cx="-6" cy="-5" rx="5" ry="3.6" className="fill-mint" opacity="0.55" />
    <circle cx="6.5" cy="-6" r="1.9" className="fill-white" />
  </g>
);

/** The pink flat tube of the home button, drawn horizontally with its cap on the right. */
const Tube = () => (
  <>
    <path
      d="M7 15.5 C13 14.5 24 14 30 14.5 L36 20 V28 L30 33.5 C24 34 13 33.5 7 32.5 Z"
      className={`fill-bubblegum ${INK}`}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M2 15 H7.5 V33 H2 Z" className={`fill-bubblegum ${INK}`} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M4 17V31M5.8 17V31" className={INK} strokeWidth="0.9" opacity=".55" />
    <path d="M14 14.4 H24.5 V33.9 H14 Z" className={`fill-white ${INK}`} strokeWidth="1.6" strokeLinejoin="round" />
    <path
      d="M19.3 18.6c-2.4-1.1-4 .8-3.5 3.1.3 1.5.8 4.4 1.5 5.7.4.8 1.1.6 1.4-.3.3-1 .5-2 .6-2 .1 0 .3 1 .6 2 .3.9 1 1.1 1.4.3.7-1.3 1.2-4.2 1.5-5.7.5-2.3-1.1-4.2-3.5-3.1z"
      className={`fill-mint ${INK}`}
      strokeWidth="1"
      strokeLinejoin="round"
      transform="translate(0.4 0.6)"
    />
    <path d="M9.5 18.2 H13 M26 17 H30" className="stroke-white" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
    <rect x="35.5" y="19.5" width="9.5" height="9" rx="2" className={`fill-mint ${INK}`} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M38.5 21.2V26.8M41 21.2V26.8" className={INK} strokeWidth="0.9" opacity=".45" />
  </>
);

/**
 * A toothbrush seen from the side and the pink tube that squeezes one pea of paste onto it
 * (or, on request, a long blob that sags past both ends of the head). Only transform and
 * opacity are animated; with reduced motion the tube never shows and the pea just fades in.
 */
const ToothpasteQuantity = ({ stage, blob, reduced }: ToothpasteQuantityProps) => {
  const tubeOnScreen = stage === "arrive" || stage === "squeeze" || stage === "drop";
  const peaOnScreen = stage === "squeeze" || stage === "drop" || stage === "leave";
  const peaPose =
    stage === "squeeze"
      ? { ...PEA_HANG, scaleX: 1, scaleY: 1, opacity: 1 }
      : stage === "drop"
        ? {
            x: [PEA_HANG.x, -1.5, 0, 0, 0],
            y: [PEA_HANG.y, -6, 2, -6, 0],
            scaleX: [1, 1, 1.2, 0.95, 1],
            scaleY: [1, 1.06, 0.8, 1.07, 1],
            opacity: 1,
          }
        : stage === "leave"
          ? { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }
          : { ...PEA_START, scaleX: 0, scaleY: 0, opacity: 0 };

  return (
    <svg viewBox="0 -92 320 234" className="w-full h-auto" aria-hidden data-stage={stage} data-blob={blob || undefined}>
      {/* Soft shadow on the sink */}
      <ellipse cx="160" cy="134" rx="140" ry="5" className="fill-ink" opacity="0.08" />

      {/* Brush: tufted bristles, mint head, tapered rainbow handle (like the mascot's) */}
      <motion.g
        animate={stage === "drop" && !reduced ? { scaleY: [1, 1, 0.94, 1.02, 1] } : { scaleY: 1 }}
        transition={{ duration: 0.7, times: [0, 0.55, 0.65, 0.85, 1] }}
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      >
        {/* Bristle tufts (drawn first: the head covers their base) */}
        {Array.from({ length: 7 }, (_, i) => {
          const top = i === 0 || i === 6 ? 62 : i === 1 || i === 5 ? 58 : 55;
          return (
            <rect
              key={i}
              x={203 + i * 13.5}
              y={top}
              width="11"
              height={96 - top}
              rx="5.5"
              className={i % 2 === 0 ? "fill-white stroke-ink" : "fill-[#CDEBFF] stroke-ink"}
              strokeWidth="2.5"
            />
          );
        })}

        {/* Head */}
        <rect x="190" y="84" width="112" height="38" rx="19" className="fill-mint stroke-ink" strokeWidth="3" />
        <path d="M206 94 H286" className="stroke-white" strokeWidth="4" strokeLinecap="round" opacity="0.55" />

        {/* Handle: wide grip tapering into a slim neck */}
        <clipPath id="brush-handle">
          <path d="M30 87 H120 C150 87 160 97 192 97 V111 C160 111 150 121 120 121 H30 A17 17 0 0 1 30 87 Z" />
        </clipPath>
        <path
          d="M30 87 H120 C150 87 160 97 192 97 V111 C160 111 150 121 120 121 H30 A17 17 0 0 1 30 87 Z"
          className="fill-bubblegum"
        />
        <g clipPath="url(#brush-handle)">
          <rect x="58" y="80" width="12" height="46" className="fill-sunshine" />
          <rect x="76" y="80" width="12" height="46" className="fill-white" />
          <rect x="94" y="80" width="12" height="46" className="fill-[#7CCBFF]" />
          <path d="M24 94 H112" className="stroke-white" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        </g>
        <path
          d="M30 87 H120 C150 87 160 97 192 97 V111 C160 111 150 121 120 121 H30 A17 17 0 0 1 30 87 Z"
          fill="none"
          className="stroke-ink"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* The pea (behind the tube, so it seems to come out of the nozzle) */}
      <g transform={`translate(${PEA.x} ${PEA.y})`}>
        {peaOnScreen && (
          <motion.g
            data-pea
            initial={reduced ? { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 0 } : { ...PEA_START, scaleX: 0, scaleY: 0, opacity: 0 }}
            animate={
              reduced
                ? { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: blob ? 0 : 1 }
                : blob
                  ? { ...peaPose, opacity: 0, scaleX: 0.6, scaleY: 0.6 }
                  : peaPose
            }
            transition={
              reduced
                ? { duration: 0.15 }
                : stage === "squeeze"
                  ? { duration: 0.8, ease: "easeOut" }
                  : stage === "drop"
                    ? { duration: 0.7, times: [0, 0.45, 0.6, 0.8, 1], ease: "easeIn" }
                    : { type: "spring", stiffness: 300, damping: 16 }
            }
            style={CENTER}
          >
            <Pea />
          </motion.g>
        )}
      </g>

      {/* Little sparkles when the pea lands */}
      {stage === "drop" && !reduced && (
        <g data-sparkles>
          {SPARKS.map((s, i) => (
            <motion.circle
              key={i}
              cx={PEA.x}
              cy={PEA.y}
              r="3.5"
              className="fill-sunshine stroke-ink"
              strokeWidth="1.5"
              initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
              animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: 0.4 }}
              transition={{ duration: 0.6, delay: 0.42, ease: "easeOut" }}
            />
          ))}
        </g>
      )}

      {/* The tube: slides in from the top right, squeezes twice, leaves the way it came */}
      {!reduced && (
        <g transform={`translate(${NOZZLE.x} ${NOZZLE.y}) rotate(100) scale(2.25) translate(-45 -24)`}>
          <motion.g
            data-tube
            initial={TUBE_AWAY}
            animate={tubeOnScreen ? TUBE_HERE : TUBE_AWAY}
            transition={tubeOnScreen ? { duration: 1.3, ease: [0.3, 0.9, 0.4, 1] } : { duration: 0.8, ease: "easeIn" }}
          >
            <motion.g
              animate={stage === "squeeze" ? { scaleX: [1, 0.93, 1, 0.93, 1], scaleY: [1, 0.88, 1, 0.88, 1] } : { scaleX: 1, scaleY: 1 }}
              transition={{ duration: 0.8 }}
              style={CENTER}
            >
              <Tube />
            </motion.g>
          </motion.g>
        </g>
      )}

      {/* « Trop ? »: a blob that covers the whole head and sags past both ends */}
      {blob && (
        <motion.g
          data-blob-shape
          style={CENTER}
          initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: [-1.5, 1.5, -1.5] }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.5, rotate: { duration: 1.4, repeat: Infinity } }}
        >
          <ellipse cx="244" cy="52" rx="72" ry="20" className="fill-white stroke-ink" strokeWidth="3" />
          <path d="M272 68 C264 80 264 91 272 91 C280 91 280 80 272 68 Z" className="fill-white stroke-ink" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="222" cy="46" rx="22" ry="5" className="fill-mint" opacity="0.5" />
        </motion.g>
      )}
    </svg>
  );
};

export default ToothpasteQuantity;
