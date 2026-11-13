import { motion } from "framer-motion";
import { adventWindowKey, dayLabel, type AlbumPage, type Slot } from "@/lib/progress";
import { cn } from "@/lib/utils";

type WindowState = "won" | "today" | "past" | "future";

const SLOT_ICON: Record<Slot, string> = { morning: "☀️", evening: "🌙" };
const SLOT_WORD: Record<Slot, string> = { morning: "matin", evening: "soir" };

/**
 * State of one window on `now`: won, still to win today, a day that has gone by (a calm, empty
 * window: no lock, no reproach) or a day to come (locked). The morning window of today stops being
 * winnable at 14:00, when the brushing becomes an evening one.
 */
function stateOf(page: AlbumPage, day: number, slot: Slot, now: Date): WindowState {
  if (page.windows[adventWindowKey(day, slot)]) return "won";
  const thisYear = page.year === now.getFullYear();
  if (!thisYear) return page.year! < now.getFullYear() ? "past" : "future";
  if (now.getMonth() < 11) return "future";
  if (now.getMonth() > 11 || day < now.getDate()) return "past";
  if (day > now.getDate()) return "future";
  return slot === "morning" && now.getHours() >= 14 ? "past" : "today";
}

const WINDOW = {
  won: "bg-white border-2 border-[#FFD23F] shadow-[0_0_9px_#FFD23F99] text-[26px]",
  today: "bg-white/10 border-2 border-[#FFD23F] shadow-[0_0_10px_#FFD23F66] text-[22px] animate-pulse motion-reduce:animate-none",
  past: "bg-white/10 border-2 border-dashed border-white/25 text-[19px] opacity-55 grayscale",
  future: "bg-[#0d1c38] border-2 border-white/10 text-sm opacity-75",
} as const;

/** The 24 doors of the Advent calendar, two windows each (☀️ morning above, 🌙 evening below). */
const AdventDoors = ({ page, now }: { page: AlbumPage; now: Date }) => (
  <ul className="grid grid-cols-4 gap-2">
    {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
      const today = (["morning", "evening"] as const).some((slot) => stateOf(page, day, slot, now) === "today");
      return (
        <motion.li
          key={day}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(day, 12) * 0.02 }}
          className={cn(
            "flex flex-col items-center gap-1 rounded-2xl border-2 bg-[#1d3866] px-1.5 pb-1.5 pt-1",
            today ? "border-[#FFD23F] shadow-[0_0_14px_#FFD23F88]" : "border-white/20",
          )}
        >
          <span className="font-display font-bold text-lg leading-none text-[#FFD23F]">{day}</span>
          {(["morning", "evening"] as const).map((slot) => {
            const state = stateOf(page, day, slot, now);
            const sticker = page.windows[adventWindowKey(day, slot)];
            const where = `${dayLabel(day)}, ${SLOT_WORD[slot]}`;
            const label = sticker ? `${where} : ${sticker.name}` : `${where} : ${state === "today" ? "à ouvrir" : state === "future" ? "pas encore" : "fermé"}`;
            return (
              <span
                key={slot}
                role="img"
                aria-label={label}
                className={cn("w-full aspect-[5/4] rounded-xl grid place-items-center leading-none", WINDOW[state])}
              >
                {sticker ? sticker.emoji : state === "future" ? "🔒" : SLOT_ICON[slot]}
              </span>
            );
          })}
        </motion.li>
      );
    })}
  </ul>
);

export default AdventDoors;
