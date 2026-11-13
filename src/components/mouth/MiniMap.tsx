import { cn } from "@/lib/utils";
import { showsInside, stepInfo, type StepRef } from "./geometry";

const INK = "hsl(var(--ink))";
const MINT = "hsl(var(--mint))";

const COLUMNS = [
  { side: "left", x: 4, w: 18 },
  { side: "front", x: 25, w: 22 },
  { side: "right", x: 50, w: 18 },
] as const;

/** Tiny map of the whole mouth showing which part is being brushed (helps after zoom/flip). */
const MiniMap = ({ step, className }: { step: StepRef; className?: string }) => {
  const { arch, side, view } = stepInfo(step);
  return (
    <svg viewBox="0 0 72 54" className={cn("w-[72px] h-[54px] drop-shadow-sm", className)} aria-hidden>
      <rect x={1} y={1} width={70} height={52} rx={12} fill="white" stroke={INK} strokeWidth={2} />
      {(["upper", "lower"] as const).map((row) => {
        const y = row === "upper" ? 7 : 29;
        const rowActive = row === arch;
        return (
          <g key={row}>
            {COLUMNS.map((c) => {
              const active = rowActive && c.side === side;
              return (
                <rect
                  key={c.side}
                  x={c.x}
                  y={y}
                  width={c.w}
                  height={18}
                  rx={5}
                  fill={active ? MINT : "white"}
                  stroke={INK}
                  strokeOpacity={active ? 1 : 0.35}
                  strokeWidth={1.8}
                  strokeDasharray={active && showsInside(view) ? "3 2" : undefined}
                />
              );
            })}
            {rowActive && view === "top" && (
              <text x={side === "left" ? 13 : 59} y={y + 13} fontSize={10} textAnchor="middle" fill={INK}>
                ▲
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default MiniMap;
