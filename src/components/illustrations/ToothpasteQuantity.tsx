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

const PEA = { x: 230, y: 40 };
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
    {/* Brush: bubblegum handle, mint head, white bristles */}
    <motion.g
      key={`brush-${pops}`}
      initial={reduced || pops === 0 ? false : { scaleY: 0.94 }}
      animate={{ scaleY: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
    >
      <rect x="18" y="94" width="160" height="28" rx="14" className="fill-bubblegum stroke-ink" strokeWidth="3" />
      <rect x="165" y="80" width="130" height="56" rx="16" className="fill-mint stroke-ink" strokeWidth="3" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={176 + i * 13} y="52" width="9" height="32" rx="4.5" className="fill-white stroke-ink" strokeWidth="2" />
      ))}
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
          <ellipse cx="228" cy="52" rx="84" ry="20" className="fill-white stroke-ink" strokeWidth="3" />
          <path d="M292 56 q8 14 0 26 q-8 -12 0 -26z" className="fill-white stroke-ink" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="206" cy="46" rx="22" ry="5" className="fill-mint" opacity="0.5" />
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
