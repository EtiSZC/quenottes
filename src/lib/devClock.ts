// Development only (loaded by main.tsx when import.meta.env.DEV; absent from every build):
// lets a phone on the same Wi-Fi look at a season that is not running today, without touching
// real data (the dev server is its own origin, so it has its own localStorage).
//   http://<mac>:8080/?now=2026-12-05T09:00             → the app believes it is that moment (the clock keeps running)
//   http://<mac>:8080/?now=2026-12-05T09:00&seed=advent → plus a child (Léa) with Advent windows already opened
import { editionId, replaceProgress, toDay, type Session } from "./progress";

export function installDevClock() {
  const params = new URLSearchParams(window.location.search);
  const target = new Date(params.get("now") ?? "").getTime();
  if (!Number.isNaN(target)) {
    const RealDate = Date;
    const offset = target - RealDate.now();
    class DevDate extends RealDate {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(...((args.length ? args : [RealDate.now() + offset]) as [any]));
      }
      static now() {
        return RealDate.now() + offset;
      }
    }
    globalThis.Date = DevDate as DateConstructor;
  }
  if (params.get("seed") === "advent") seedAdvent();
}

/** Léa brushed since 1 December: most windows won, a few missed, today's morning done. */
function seedAdvent() {
  const now = new Date();
  const today = now.getMonth() === 11 ? Math.min(now.getDate(), 24) : 0;
  const sessions: Session[] = [];
  const stickers: string[] = [];
  const win = (day: number, slot: "morning" | "evening") => {
    sessions.push({ date: toDay(new Date(now.getFullYear(), 11, day)), slot });
    stickers.push(editionId(`d${String(day).padStart(2, "0")}${slot === "morning" ? "m" : "s"}`, now.getFullYear()));
  };
  for (let day = 1; day <= today; day++) {
    if (day % 3 !== 0 || day === today) win(day, "morning"); // every 3rd morning missed
    if (day < today && day % 4 !== 0) win(day, "evening"); // every 4th evening missed
  }
  replaceProgress({ version: 2, profiles: [{ id: "p1", name: "Léa", avatar: "🦊" }], data: { p1: { sessions, stickers } }, active: ["p1"] });
}
