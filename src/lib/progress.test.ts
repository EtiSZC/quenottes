import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_STICKERS,
  AUTUMN_STICKERS,
  HALLOWEEN_STICKERS,
  STICKERS,
  albumPages,
  editionId,
  getProfile,
  isAutumnSeason,
  isHalloweenSeason,
  loadProgress,
  placeInGrid,
  migrateStickerIds,
  recordSession,
  slotOf,
  visibleCells,
  streakOf,
  weekOf,
  type Session,
} from "./progress";

// Local-time dates (month is 0-based): Wednesday 7 October 2026.
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0);

describe("progress", () => {
  beforeEach(() => localStorage.clear());

  it("splits the day into morning (before 2 pm) and evening", () => {
    expect(slotOf(at(7, 7))).toBe("morning");
    expect(slotOf(at(7, 13))).toBe("morning");
    expect(slotOf(at(7, 19))).toBe("evening");
  });

  it("awards one random, not-yet-earned sticker per new slot", () => {
    const first = recordSession(at(7, 7), undefined, () => 0.99); // last of the 20
    expect(first).toMatchObject({ slot: "morning", newSticker: STICKERS[19] });
    const second = recordSession(at(7, 20), undefined, () => 0); // first of the remaining 19
    expect(second.newSticker).toEqual(STICKERS[0]);
    expect(getProfile().stickers).toEqual([STICKERS[19].id, STICKERS[0].id]);
  });

  it("never gives the same sticker twice, and stops once the album is complete", () => {
    for (let day = 1; day <= 10; day++) {
      recordSession(at(day, 8));
      recordSession(at(day, 20));
    }
    const earned = getProfile().stickers;
    expect(earned).toHaveLength(20);
    expect(new Set(earned).size).toBe(20);
    expect(recordSession(at(11, 8)).newSticker).toBeNull();
  });

  it("counts brushing twice in the same slot only once (no extra sticker)", () => {
    recordSession(at(7, 7));
    const again = recordSession(at(7, 8));
    expect(again.newSticker).toBeNull();
    expect(getProfile().sessions).toHaveLength(1);
  });

  it("keeps a forgiving streak: one slot a day is enough, today not done yet doesn't break it", () => {
    const sessions: Session[] = [
      { date: "2026-10-04", slot: "evening" },
      { date: "2026-10-05", slot: "morning" },
      { date: "2026-10-06", slot: "evening" },
    ];
    expect(streakOf(sessions, at(7, 7))).toBe(3); // nothing yet today
    expect(streakOf([...sessions, { date: "2026-10-07", slot: "morning" }], at(7, 8))).toBe(4);
    expect(streakOf([{ date: "2026-10-04", slot: "morning" }], at(7, 7))).toBe(0); // a full day missed
  });

  it("builds the current week from Monday to Sunday", () => {
    const week = weekOf([{ date: "2026-10-07", slot: "evening" }], at(7, 21));
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
    expect(week[2]).toMatchObject({ label: "M", isToday: true, morning: false, evening: true });
    expect(week[3].isFuture).toBe(true);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("brosse-brille:progress:v1", "{not json");
    expect(recordSession(at(7, 7), undefined, () => 0).newSticker).toEqual(STICKERS[0]);
  });
});

describe("seasonal stickers (Halloween, then « Automne en forêt »)", () => {
  beforeEach(() => localStorage.clear());
  const date = (month: number, day: number, hour = 8, year = 2026) => new Date(year, month, day, hour);
  const allClassics = () => {
    for (let d = 1; d <= 10; d++) {
      recordSession(date(8, d, 8)); // September: classics only
      recordSession(date(8, d, 20));
    }
    expect(getProfile().stickers).toHaveLength(STICKERS.length);
  };

  it("Halloween runs 15 October → 2 November and « Automne en forêt » 3 → 30 November, every year", () => {
    expect(isHalloweenSeason(date(9, 14, 23))).toBe(false);
    expect(isHalloweenSeason(date(9, 15, 0))).toBe(true);
    expect(isHalloweenSeason(date(10, 2, 23))).toBe(true);
    expect(isHalloweenSeason(date(10, 3, 0))).toBe(false);
    expect(isAutumnSeason(date(10, 2, 23))).toBe(false);
    expect(isAutumnSeason(date(10, 3, 0))).toBe(true);
    expect(isAutumnSeason(date(10, 30, 23))).toBe(true);
    expect(isAutumnSeason(date(11, 1, 0))).toBe(false);
    expect(isHalloweenSeason(date(9, 20, 8, 2027))).toBe(true);
  });

  it("no sticker shares an id or a picture with another, whatever the set", () => {
    expect(new Set(ALL_STICKERS.map((s) => s.id)).size).toBe(ALL_STICKERS.length);
    expect(new Set(ALL_STICKERS.map((s) => s.emoji)).size).toBe(ALL_STICKERS.length);
    expect(AUTUMN_STICKERS).toHaveLength(56); // two brushings a day for 28 days
  });

  it("a child with every classic gets a Halloween sticker in season, nothing in December", () => {
    allClassics();
    const october = recordSession(date(9, 20), undefined, () => 0);
    expect(october.newSticker).toEqual(HALLOWEEN_STICKERS[0]);
    expect(october.season).toBe("halloween");
    expect(getProfile().stickers).toContain(editionId(HALLOWEEN_STICKERS[0].id, 2026)); // stored with its year
    expect(recordSession(date(11, 10)).newSticker).toBeNull();
    expect(getProfile().stickers).toContain(editionId(HALLOWEEN_STICKERS[0].id, 2026)); // kept after the season
  });

  it("in season, Halloween stickers come first, then the classics once all are won", () => {
    for (let i = 0; i < HALLOWEEN_STICKERS.length; i++) {
      const r = recordSession(date(9, 15 + Math.floor(i / 2), i % 2 ? 20 : 8));
      expect(HALLOWEEN_STICKERS.some((h) => h.id === r.newSticker?.id)).toBe(true);
    }
    expect(new Set(getProfile().stickers).size).toBe(HALLOWEEN_STICKERS.length);
    const next = recordSession(date(9, 31, 20));
    expect(STICKERS.some((c) => c.id === next.newSticker?.id)).toBe(true);
    expect(next.season).toBeNull();
  });

  it("in November the autumn edition comes first: 56 brushings win 56 different stickers", () => {
    allClassics();
    const seen = new Set<string>();
    for (let d = 3; d <= 30; d++) {
      for (const hour of [8, 20]) {
        const r = recordSession(date(10, d, hour));
        expect(AUTUMN_STICKERS.some((a) => a.id === r.newSticker?.id)).toBe(true);
        expect(r.season).toBe("autumn");
        seen.add(r.newSticker!.id);
      }
    }
    expect(seen.size).toBe(56);
    expect(recordSession(date(10, 30, 21)).newSticker).toBeNull(); // slot already filled
  });

  it("every year the grid starts again: last year's stickers can be won again", () => {
    for (let i = 0; i < HALLOWEEN_STICKERS.length; i++) recordSession(date(9, 15 + Math.floor(i / 2), i % 2 ? 20 : 8));
    const r = recordSession(date(9, 20, 8, 2027), undefined, () => 0);
    expect(r.newSticker).toEqual(HALLOWEEN_STICKERS[0]); // the pumpkin again, in the 2027 edition
    expect(getProfile().stickers).toContain(editionId("pumpkin", 2026));
    expect(getProfile().stickers).toContain(editionId("pumpkin", 2027));
  });

  it("Halloween stickers saved without a year (v0.9–v0.11) become the 2026 edition on load", () => {
    localStorage.setItem(
      "brosse-brille:progress:v2",
      JSON.stringify({ version: 2, profiles: [{ id: "p1", name: "Léa", avatar: "🦊" }], data: { p1: { sessions: [], stickers: ["unicorn", "pumpkin", "ghost"] } }, active: ["p1"] }),
    );
    expect(loadProgress().data.p1.stickers).toEqual(["unicorn", "pumpkin@2026", "ghost@2026"]);
    expect(migrateStickerIds(["pumpkin@2026", "pumpkin"])).toEqual(["pumpkin@2026"]);
  });

  it("brushing twice in the same slot still earns a single sticker", () => {
    recordSession(date(9, 20, 8));
    expect(recordSession(date(9, 20, 9)).newSticker).toBeNull();
    expect(getProfile().stickers).toHaveLength(1);
  });
});

describe("album pages", () => {
  const halloween2026 = HALLOWEEN_STICKERS.slice(0, 8).map((s) => editionId(s.id, 2026));
  const classics = STICKERS.map((s) => s.id);

  it("in season the running grid is open at the top, finished classics are folded under it", () => {
    const pages = albumPages([...classics, ...halloween2026], new Date(2026, 10, 7));
    expect(pages.map((p) => [p.key, p.current])).toEqual([
      ["autumn-2026", true],
      ["classic", false],
      ["halloween-2026", false],
    ]);
    expect(pages[0]).toMatchObject({ title: "Automne en forêt 2026", won: 0, total: 20, size: 56 });
    expect(pages[1].note).toBe("Tous gagnés\u00A0! 🎉");
    expect(pages[2]).toMatchObject({ title: "Halloween 2026", won: 8, total: 15, current: false });
    expect(pages[2].note).toContain("octobre 2027");
  });

  it("a long grid shows 20 boxes, then one more row each time they are all full", () => {
    const cases: [number, number][] = [[0, 20], [9, 20], [19, 20], [20, 24], [23, 24], [24, 28], [51, 52], [55, 56], [56, 56]];
    for (const [won, boxes] of cases) expect(visibleCells(won, 56)).toBe(boxes);
    expect(visibleCells(8, 15)).toBe(15); // short grids always show every box
    expect(visibleCells(0, 20)).toBe(20);
  });

  it("the autumn grid follows the winning order and grows with the stickers won", () => {
    const stickers = (n: number) => AUTUMN_STICKERS.slice(10, 10 + n).map((s) => editionId(s.id, 2026));
    const nine = albumPages(stickers(9), new Date(2026, 10, 7))[0];
    expect(nine).toMatchObject({ key: "autumn-2026", slotted: true, won: 9, total: 20 });
    expect(nine.earnedOrder).toEqual(AUTUMN_STICKERS.slice(10, 19).map((s) => s.id));
    expect(albumPages(stickers(20), new Date(2026, 10, 7))[0]).toMatchObject({ won: 20, total: 24, complete: false });
    expect(albumPages(AUTUMN_STICKERS.map((s) => editionId(s.id, 2026)), new Date(2026, 10, 7)).find((p) => p.key === "autumn-2026")).toMatchObject({ won: 56, total: 56, complete: true });
  });

  it("the first 20 stickers are scattered over the boxes, always the same way for one child; later rows fill in order", () => {
    const boxes = placeInGrid(20, 24, "p1-autumn-2026");
    expect(boxes.slice(0, 20).slice().sort((x, y) => x! - y!)).toEqual(Array.from({ length: 20 }, (_, i) => i)); // every box used once
    expect(boxes.slice(0, 20)).not.toEqual(Array.from({ length: 20 }, (_, i) => i)); // not in winning order
    expect(boxes.slice(20)).toEqual([null, null, null, null]);
    expect(placeInGrid(20, 24, "p1-autumn-2026")).toEqual(boxes); // stable
    expect(placeInGrid(20, 24, "p2-autumn-2026")).not.toEqual(boxes); // another child, another picture
    // stickers already placed never move when more are won
    const nine = placeInGrid(9, 20, "p1-autumn-2026");
    expect(placeInGrid(10, 20, "p1-autumn-2026").map((k) => (k === 9 ? null : k))).toEqual(nine);
    const more = placeInGrid(23, 24, "p1-autumn-2026");
    expect(more.slice(20)).toEqual([20, 21, 22, null]);
  });

  it("an unfinished classics grid stays open when no season is running", () => {
    const pages = albumPages(classics.slice(0, 5), new Date(2026, 11, 15));
    expect(pages.map((p) => [p.key, p.current])).toEqual([["classic", true]]);
  });

  it("a season with nothing won stays hidden outside its dates, and shows up while it runs", () => {
    expect(albumPages(classics.slice(0, 3), new Date(2026, 10, 7)).map((p) => p.key)).toEqual(["autumn-2026", "classic"]);
    expect(albumPages(classics.slice(0, 3), new Date(2026, 11, 7)).map((p) => p.key)).toEqual(["classic"]);
    expect(albumPages([], new Date(2026, 9, 20)).map((p) => p.key)).toEqual(["halloween-2026", "classic"]);
  });

  it("next year's edition opens empty above last year's folded one", () => {
    const pages = albumPages([...classics, ...halloween2026], new Date(2027, 9, 20));
    expect(pages.map((p) => [p.key, p.current, p.won])).toEqual([
      ["halloween-2027", true, 0],
      ["classic", false, 20],
      ["halloween-2026", false, 8],
    ]);
  });

  it("when the running edition is complete, the classics reopen", () => {
    const all = HALLOWEEN_STICKERS.map((s) => editionId(s.id, 2026));
    const pages = albumPages(all, new Date(2026, 9, 25));
    expect(pages.map((p) => [p.key, p.current])).toEqual([
      ["classic", true],
      ["halloween-2026", false],
    ]);
    expect(pages[1].note).toBe("Tous gagnés\u00A0! 🎉");
  });
});
