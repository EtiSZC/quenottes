import { AnimatePresence, motion } from "framer-motion";

export type PasteState = "empty" | "pea" | "blob";

interface ToothpasteQuantityProps {
  state: PasteState;
  /** Dashed ring that invites the first tap. */
  hint: boolean;
  /** Counts every change of the brush, so sparkles and squash replay. */
  pops: number;
  reduced: boolean;
}

// SVG elements scale around their own centre.
const CENTER = { transformBox: "fill-box", transformOrigin: "center" } as const;

const PEA = { x: 246, y: 45 };
const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 34, y: Math.sin(angle) * 34 };
});

/**
 * A toothbrush seen from the side with its paste: nothing, a round pea (about a quarter of the head),
 * or a long blob that sags past both ends. Only transform and opacity are animated.
 */
const ToothpasteQuantity = ({ state, hint, pops, reduced }: ToothpasteQuantityProps) => (
  <svg viewBox="0 0 320 142" className="w-full h-auto" aria-hidden data-state={state}>
    {/* Soft shadow on the sink */}
    <ellipse cx="160" cy="134" rx="140" ry="5" className="fill-ink" opacity="0.08" />

    {/* Brush: tufted bristles, mint head, tapered rainbow handle (like Brillou's) */}
    <motion.g
      key={`brush-${pops}`}
      initial={reduced || pops === 0 ? false : { scaleY: 0.94 }}
      animate={{ scaleY: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
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

    {hint && state === "empty" && (
      <motion.circle
        data-hint-pulse
        cx={PEA.x}
        cy={PEA.y}
        r="26"
        fill="none"
        className="stroke-sunshine"
        strokeWidth="4"
        strokeDasharray="7 7"
        style={CENTER}
        animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    )}

    <AnimatePresence>
      {state === "pea" && (
        <motion.g
          key="pea"
          style={CENTER}
          initial={reduced ? { opacity: 0 } : { scale: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: [0, 1.15, 1] }}
          exit={reduced ? { opacity: 0 } : { scale: 1.5, opacity: 0 }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.35 }}
        >
          <circle cx={PEA.x} cy={PEA.y} r="15" className="fill-white stroke-ink" strokeWidth="3" />
          <circle cx={PEA.x - 5} cy={PEA.y - 5} r="4" className="fill-mint" opacity="0.55" />
          <circle cx={PEA.x + 5} cy={PEA.y - 6} r="1.8" className="fill-white" />
        </motion.g>
      )}
      {state === "blob" && (
        <motion.g
          key="blob"
          data-blob
          style={CENTER}
          initial={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: [-1.5, 1.5, -1.5] }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.5, rotate: { duration: 1.4, repeat: Infinity } }}
        >
          <ellipse cx="244" cy="52" rx="72" ry="20" className="fill-white stroke-ink" strokeWidth="3" />
          <path d="M272 68 C264 80 264 91 272 91 C280 91 280 80 272 68 Z" className="fill-white stroke-ink" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="222" cy="46" rx="22" ry="5" className="fill-mint" opacity="0.5" />
        </motion.g>
      )}
    </AnimatePresence>

    {/* Little sparkles when a pea lands */}
    {state === "pea" && !reduced && (
      <g key={`spark-${pops}`} data-sparkles>
        {SPARKS.map((s, i) => (
          <motion.circle
            key={i}
            cx={PEA.x}
            cy={PEA.y}
            r="3.5"
            className="fill-sunshine stroke-ink"
            strokeWidth="1.5"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        ))}
      </g>
    )}
  </svg>
);

export default ToothpasteQuantity;
