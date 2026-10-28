import { describe, it, expect } from "vitest";
import { AUTUMN_STICKERS, HALLOWEEN_STICKERS, STICKERS, editionId, getProfile, loadProgress, mergeProfiles, recordSession, replaceProgress, toDay, type ProgressData, type Session } from "./progress";
import { SYNC_PREFIX, decodeState, encodeState, findLosses, mergeState, normalizeName, suggestMatches, suggestSameChild } from "./sync";

const NOW = new Date(2026, 9, 11, 9);
const day = (offset: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  return toDay(d);
};
const state = (profiles: { id: string; name: string; avatar?: string; sessions?: Session[]; stickers?: string[] }[]): ProgressData => ({
  version: 2,
  profiles: profiles.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar ?? "🦊" })),
  data: Object.fromEntries(profiles.map((p) => [p.id, { sessions: p.sessions ?? [], stickers: p.stickers ?? [] }])),
  active: [profiles[0].id],
});
const decode = (text: string) => {
  const r = decodeState(text);
  if (!r.ok) throw new Error(r.error);
  return r.profiles;
};
/** Phone `local` scans phone `remote` and merges with the default matches. */
const sync = (local: ProgressData, remote: ProgressData) => mergeState(local, suggestMatches(local, decode(encodeState(remote, NOW)))).data;
const history = (d: ProgressData) =>
  Object.fromEntries(
    d.profiles.map((p) => [normalizeName(p.name), { s: d.data[p.id].sessions.map((s) => `${s.date}${s.slot}`).sort(), k: [...d.data[p.id].stickers].sort() }]),
  );

describe("sync payload", () => {
  it("round-trips history, stickers and accented names", () => {
    const sessions: Session[] = [
      { date: day(-3), slot: "evening" },
      { date: day(-1), slot: "morning" },
      { date: day(0), slot: "morning" },
    ];
    const text = encodeState(state([{ id: "pabc", name: "Léa", avatar: "🐼", sessions, stickers: ["lion", "unicorn"] }]), NOW);
    expect(text.startsWith(SYNC_PREFIX)).toBe(true);
    expect(/^[\x20-\x7e]+$/.test(text)).toBe(true); // pure ASCII for any scanner
    const [p] = decode(text);
    expect(p).toMatchObject({ id: "pabc", name: "Léa", avatar: "🐼" });
    expect(p.sessions).toEqual(sessions);
    expect(p.stickers.sort()).toEqual(["lion", "unicorn"]);
  });

  it("stays small: 4 children brushing twice a day for 2 years fit in one QR", () => {
    const full: Session[] = [];
    for (let i = 0; i < 730; i++) full.push({ date: day(-i), slot: "morning" }, { date: day(-i), slot: "evening" });
    const kids = ["Léa", "Tom", "Zoé", "Noé"].map((name, i) => ({ id: `p${i}xxxxxxxx`, name, sessions: full, stickers: STICKERS.map((s) => s.id) }));
    expect(encodeState(state(kids), NOW).length).toBeLessThan(1000);
  });

  it("refuses anything that isn't a valid Quenottes code", () => {
    const good = encodeState(state([{ id: "pabc", name: "Léa" }]), NOW);
    const json = JSON.parse(good.slice(SYNC_PREFIX.length));
    const tamper = (patch: (j: typeof json) => void) => {
      const j = structuredClone(json);
      patch(j);
      return SYNC_PREFIX + JSON.stringify(j);
    };
    for (const bad of [
      "https://example.com",
      SYNC_PREFIX + "{not json",
      tamper((j) => (j.v = 2)),
      tamper((j) => (j.p = [j.p[0], j.p[0], j.p[0], j.p[0], j.p[0]])),
      tamper((j) => (j.p[0].a = 99)),
      tamper((j) => (j.p[0].i = "<script>")),
      tamper((j) => (j.p[0].k = 2 ** 25)),
    ]) {
      expect(decodeState(bad).ok).toBe(false);
    }
  });
});

describe("sync merge", () => {
  const phoneA = () =>
    state([
      { id: "pzzz", name: "Léa", sessions: [{ date: day(-2), slot: "morning" }], stickers: ["unicorn"] },
      { id: "pyyy", name: "Tom", sessions: [], stickers: [] },
    ]);
  const phoneB = () =>
    state([
      { id: "paaa", name: " lea ", sessions: [{ date: day(-2), slot: "evening" }, { date: day(-2), slot: "morning" }], stickers: ["rocket"] },
      { id: "pbbb", name: "TOM", sessions: [{ date: day(-1), slot: "evening" }], stickers: ["lion"] },
    ]);

  it("matches children by name, ignoring accents, case and spaces", () => {
    const m = suggestMatches(phoneA(), decode(encodeState(phoneB(), NOW)));
    expect(m.map((x) => x.target)).toEqual([
      { kind: "local", id: "pzzz" },
      { kind: "local", id: "pyyy" },
    ]);
  });

  it("is a union: nothing is lost, stickers included", () => {
    const merged = sync(phoneA(), phoneB());
    const lea = merged.data[merged.profiles.find((p) => p.name === "Léa")!.id];
    expect(lea.sessions).toHaveLength(2);
    expect(lea.stickers.sort()).toEqual(["rocket", "unicorn"]);
  });

  it("is idempotent and gives the same history in both directions", () => {
    const a1 = sync(phoneA(), phoneB());
    expect(history(sync(a1, phoneB()))).toEqual(history(a1)); // scanning again changes nothing
    const b1 = sync(phoneB(), a1); // B scans A's updated code
    expect(history(b1)).toEqual(history(a1));
  });

  it("converges on the same ids, so the next sync matches by id", () => {
    const a1 = sync(phoneA(), phoneB());
    const b1 = sync(phoneB(), a1);
    expect(a1.profiles.map((p) => p.id).sort()).toEqual(["paaa", "pbbb"]);
    expect(b1.profiles.map((p) => p.id).sort()).toEqual(["paaa", "pbbb"]);
    expect(a1.active).toEqual(["paaa"]); // the active child follows the rename
  });

  it("keeps each phone's own names and avatars", () => {
    const a1 = sync(phoneA(), phoneB());
    expect(a1.profiles.map((p) => p.name)).toEqual(["Léa", "Tom"]);
  });

  it("adds a child that only exists on the other phone (when there is room), never beyond 4", () => {
    const remote = state([{ id: "pnew", name: "Zoé", stickers: ["bee"] }]);
    const merged = sync(phoneA(), remote);
    expect(merged.profiles.map((p) => p.name)).toEqual(["Léa", "Tom", "Zoé"]);
    const full = state(["A", "B", "C", "D"].map((n, i) => ({ id: `p${i}`, name: n })));
    expect(suggestMatches(full, decode(encodeState(remote, NOW)))[0].target).toEqual({ kind: "ignore" });
  });

  it("doesn't let a name match steal a child already synced by id", () => {
    const local = state([{ id: "p1", name: "Léa" }, { id: "p2", name: "Léa" }]);
    const remote = decode(encodeState(state([{ id: "p9", name: "Léa" }, { id: "p2", name: "Léa" }]), NOW));
    const m = suggestMatches(local, remote);
    expect(m.find((x) => x.remote.id === "p2")!.target).toEqual({ kind: "local", id: "p2" });
    expect(m.find((x) => x.remote.id === "p9")!.target).toEqual({ kind: "local", id: "p1" });
  });
});

describe("sticker safety (a sync never loses a sticker)", () => {
  const album = (d: ProgressData, name: string) => [...d.data[d.profiles.find((p) => normalizeName(p.name) === normalizeName(name))!.id].stickers].sort();
  const lea = (id: string, stickers: string[], sessions: Session[] = []) => state([{ id, name: "Léa", sessions, stickers }]);

  it("a phone that is behind catches up, and the up-to-date phone loses nothing", () => {
    const ahead = lea("pa", ["unicorn", "rocket", "lion"]);
    const behind = lea("pb", ["unicorn"]);
    expect(album(sync(behind, ahead), "Léa")).toEqual(["lion", "rocket", "unicorn"]);
    expect(album(sync(ahead, behind), "Léa")).toEqual(["lion", "rocket", "unicorn"]);
  });

  it("different albums on each phone: after both scans, both have every sticker", () => {
    const a = lea("pa", ["unicorn", "rocket"]);
    const b = lea("pb", ["lion", "bee"]);
    const a1 = sync(a, b); // A scans B
    const b1 = sync(b, a1); // B scans A's updated code ("À votre tour")
    const union = ["bee", "lion", "rocket", "unicorn"];
    expect(album(a1, "Léa")).toEqual(union);
    expect(album(b1, "Léa")).toEqual(union);
    const { summary } = mergeState(a, suggestMatches(a, decode(encodeState(b, NOW))));
    expect(summary[0].addedStickers).toBe(2);
  });

  it("same brushing on both phones with a different sticker drawn: both stickers are kept, no duplicate", () => {
    const slot: Session[] = [{ date: day(-1), slot: "morning" }];
    const a1 = sync(lea("pa", ["lion"], slot), lea("pb", ["bee"], slot));
    const k = a1.data[a1.profiles[0].id];
    expect(k.stickers.sort()).toEqual(["bee", "lion"]);
    expect(new Set(k.stickers).size).toBe(k.stickers.length);
    expect(k.sessions).toHaveLength(1); // the brushing itself counts once
  });

  it("an ignored child, or one that doesn't fit (4 profiles), leaves this phone's albums untouched", () => {
    const local = lea("pa", ["unicorn", "rocket"]);
    const remote = decode(encodeState(lea("pb", ["lion"]), NOW));
    const ignored = mergeState(local, [{ remote: remote[0], target: { kind: "ignore" } }]).data;
    expect(ignored.data).toEqual(local.data);

    const full = state(["A", "B", "C", "D"].map((n, i) => ({ id: `p${i}`, name: n, stickers: ["bee"] })));
    const zoe = decode(encodeState(state([{ id: "pz", name: "Zoé", stickers: ["fox"] }]), NOW));
    expect(sync(full, state([{ id: "pz", name: "Zoé", stickers: ["fox"] }])).data).toEqual(full.data);
    expect(suggestMatches(full, zoe)[0].target).toEqual({ kind: "ignore" });
  });

  it("a complete album (20/20) reaches the other phone, which then draws no duplicate", () => {
    const all = STICKERS.map((s) => s.id);
    const b1 = sync(lea("pb", ["unicorn", "rocket"]), lea("pa", all));
    expect(album(b1, "Léa")).toHaveLength(20);
    replaceProgress(b1);
    const id = b1.profiles[0].id;
    expect(recordSession(new Date(2026, 9, 11, 20), id).newSticker).toBeNull();
    expect(new Set(getProfile(id).stickers).size).toBe(20);
  });

  it("the safety net detects any loss (stickers, brushings, a renamed child)", () => {
    const before = lea("pb", ["unicorn", "lion"], [{ date: day(-1), slot: "evening" }]);
    const shrunk = lea("pb", ["unicorn"], []);
    expect(findLosses(before, shrunk)).toEqual(["Léa: autocollant lion", `Léa: brossage ${day(-1)} soir`]);
    const renamed = lea("pa", ["unicorn", "lion"], [{ date: day(-1), slot: "evening" }]);
    expect(findLosses(before, renamed, { pb: "pa" })).toEqual([]);
    expect(findLosses(before, renamed)).toEqual(["Léa: profil disparu"]);
  });
});

describe("each child keeps their own album (fix 2026-10-14)", () => {
  type Kid = { id: string; name: string; avatar?: string; stickers: string[]; sessions?: Session[] };
  const phone = (kids: Kid[]): ProgressData => state(kids);
  /** Albums by child name (sorted), as a parent sees them; "Moi" for an unnamed profile. */
  const albums = (d: ProgressData) =>
    Object.fromEntries(d.profiles.map((p) => [p.name || "Moi", [...d.data[p.id].stickers].sort()]));
  const ids = (d: ProgressData) => d.profiles.map((p) => p.id);
  /** Like the app: a child never earns a sticker they already have. */
  const add = (d: ProgressData, name: string, sticker: string) => {
    const album = d.data[d.profiles.find((p) => p.name === name)!.id].stickers;
    if (!album.includes(sticker)) album.push(sticker);
  };

  it("children created on one phone: on both phones, each child has exactly their own stickers", () => {
    // Today's installs: the first profile is "default" on both phones.
    let a = phone([{ id: "default", name: "Léa", stickers: ["unicorn", "rocket"] }, { id: "pTomA", name: "Tom", avatar: "🐼", stickers: ["lion"] }]);
    let b = phone([{ id: "default", name: "", avatar: "🐸", stickers: [] }]); // fresh install
    b = sync(b, a);
    a = sync(a, b);
    for (const d of [a, b]) expect(albums(d)).toEqual({ Léa: ["rocket", "unicorn"], Tom: ["lion"] });
    expect(b.profiles.map((p) => `${p.avatar} ${p.name}`)).toEqual(["🦊 Léa", "🐼 Tom"]); // names and avatars arrive

    // Each phone earns new stickers, then a second round both ways.
    add(b, "Léa", "fox");
    add(b, "Tom", "bee");
    add(a, "Tom", "whale");
    b = sync(b, a);
    a = sync(a, b);
    for (const d of [a, b]) expect(albums(d)).toEqual({ Léa: ["fox", "rocket", "unicorn"], Tom: ["bee", "lion", "whale"] });
    for (const d of [a, b]) expect(new Set(ids(d)).size).toBe(d.profiles.length);
  });

  it("two installs whose 'default' profiles are different children are never mixed up", () => {
    const a = phone([{ id: "default", name: "Léa", stickers: ["unicorn"] }, { id: "pTomA", name: "Tom", stickers: ["lion"] }]);
    const b = phone([{ id: "default", name: "Tom", stickers: ["bee"] }]);
    const b1 = sync(b, a);
    expect(albums(b1)).toEqual({ Tom: ["bee", "lion"], Léa: ["unicorn"] });
  });

  it("a phone still on the old version (sending 'default') is matched by name, and nobody is renamed 'default'", () => {
    const local = phone([{ id: "pLea", name: "Léa", stickers: ["unicorn"] }]);
    const legacy = phone([{ id: "default", name: "Léa", stickers: ["fox"] }]);
    const merged = sync(local, legacy);
    expect(ids(merged)).toEqual(["pLea"]);
    expect(albums(merged)).toEqual({ Léa: ["fox", "unicorn"] });
  });

  it("a manual pairing can never make two children share one album", () => {
    const local = phone([{ id: "pZ", name: "Léa", stickers: ["unicorn"] }, { id: "pA", name: "Tom", stickers: ["lion"] }]);
    const remoteLea = decode(encodeState(phone([{ id: "pA", name: "Léa", stickers: ["fox"] }]), NOW))[0];
    const { data } = mergeState(local, [{ remote: remoteLea, target: { kind: "local", id: "pZ" } }]);
    expect(new Set(ids(data)).size).toBe(2);
    expect(albums(data)).toEqual({ Léa: ["fox", "unicorn"], Tom: ["lion"] });
  });

  it("4 children, several rounds both ways, stickers earned on both phones: each album is that child's union", () => {
    const names = ["Léa", "Tom", "Zoé", "Noé"];
    let a = phone(names.map((n, i) => ({ id: i ? `pa${i}` : "default", name: n, stickers: [STICKERS[i].id] })));
    let b = phone([{ id: "default", name: "", stickers: [] }]);
    const expected: Record<string, Set<string>> = Object.fromEntries(names.map((n, i) => [n, new Set([STICKERS[i].id])]));
    for (let round = 0; round < 3; round++) {
      b = sync(b, a);
      a = sync(a, b);
      names.forEach((n, i) => {
        const fromA = STICKERS[(4 + round * 8 + i) % STICKERS.length].id;
        const fromB = STICKERS[(8 + round * 8 + i) % STICKERS.length].id;
        add(a, n, fromA);
        add(b, n, fromB);
        expected[n].add(fromA).add(fromB);
      });
    }
    b = sync(b, a);
    a = sync(a, b);
    const want = Object.fromEntries(names.map((n) => [n, [...expected[n]].sort()]));
    for (const d of [a, b]) expect(albums(d)).toEqual(want);
  });

  it("repair: a 'Moi' holding Léa's stickers next to a hand-made 'Léa' is suggested, merged, and Léa gets her next stickers", () => {
    replaceProgress(phone([{ id: "pMoi", name: "", stickers: ["unicorn", "rocket"] }, { id: "pLea", name: "Léa", stickers: [] }, { id: "pTom", name: "Tom", stickers: ["lion"] }]));
    const [sg] = suggestSameChild(loadProgress(), []);
    expect(sg).toMatchObject({ reason: "unnamed-with-data", other: { id: "pMoi" } });
    expect(sg.candidates.map((c) => c.name)).toEqual(["Léa", "Tom"]);
    mergeProfiles("pLea", "pMoi");
    expect(albums(loadProgress())).toEqual({ Léa: ["rocket", "unicorn"], Tom: ["lion"] });

    const other = phone([{ id: "pX", name: "Léa", stickers: ["fox"] }, { id: "pY", name: "Tom", stickers: [] }]);
    const merged = sync(loadProgress(), other);
    expect(albums(merged)).toEqual({ Léa: ["fox", "rocket", "unicorn"], Tom: ["lion"] });
    expect(suggestSameChild(merged, [])).toEqual([]);
  });

  it("suggests same-name duplicates, and 'Non' hides the suggestion", () => {
    const d = phone([{ id: "p1", name: "Léa", stickers: [] }, { id: "p2", name: " lea ", stickers: ["fox"] }]);
    expect(suggestSameChild(d, []).map((x) => [x.reason, x.other.id, x.candidates[0].id])).toEqual([["same-name", "p2", "p1"]]);
    expect(suggestSameChild(d, ["p2"])).toEqual([]);
  });
});

describe("seasonal stickers travel in the QR (fields h and e)", () => {
  const H = HALLOWEEN_STICKERS.map((s) => editionId(s.id, 2026));
  const C = STICKERS.map((s) => s.id);
  const wire = (text: string) => JSON.parse(text.slice(SYNC_PREFIX.length));

  it("round-trips classics in k and Halloween 2026 in h", () => {
    const text = encodeState(state([{ id: "p1", name: "Léa", stickers: [C[0], H[0], H[14], C[19]] }]), NOW);
    expect(wire(text).p[0]).toMatchObject({ k: 1 | (1 << 19), h: 1 | (1 << 14) });
    expect(wire(text).p[0]).not.toHaveProperty("e");
    expect([...decode(text)[0].stickers].sort()).toEqual([C[0], C[19], H[0], H[14]].sort());
  });

  it("other editions travel in e as a bitmap, one entry per season and year", () => {
    const stickers = [
      editionId(HALLOWEEN_STICKERS[2].id, 2027),
      editionId(AUTUMN_STICKERS[0].id, 2026),
      editionId(AUTUMN_STICKERS[55].id, 2026),
      editionId(AUTUMN_STICKERS[9].id, 2027),
    ];
    const text = encodeState(state([{ id: "p1", name: "Léa", stickers }]), NOW);
    expect(Object.keys(wire(text).p[0].e).sort()).toEqual(["a2026", "a2027", "h2027"]);
    expect(decode(text)[0].stickers.sort()).toEqual(stickers.sort());
  });

  it("leaves h and e out when a child has no seasonal sticker (same QR as v0.8)", () => {
    const p = wire(encodeState(state([{ id: "p1", name: "Léa", stickers: [C[3]] }]), NOW)).p[0];
    expect(p).not.toHaveProperty("h");
    expect(p).not.toHaveProperty("e");
  });

  it("still reads a code from an older phone (its Halloween stickers are the 2026 edition), and refuses broken fields", () => {
    const old = SYNC_PREFIX + JSON.stringify({ v: 1, p: [{ i: "p1", n: "Léa", a: 0, d: 0, s: "", k: 5, h: 1 }] });
    expect(decode(old)[0].stickers).toEqual([C[0], C[2], H[0]]);
    const code = (patch: object) => SYNC_PREFIX + JSON.stringify({ v: 1, p: [{ i: "p1", n: "Léa", a: 0, d: 0, s: "", k: 5, ...patch }] });
    for (const h of [-1, 1.5, 2 ** HALLOWEEN_STICKERS.length, "3"]) expect(decodeState(code({ h })).ok).toBe(false);
    const valid = encodeState(state([{ id: "p1", name: "Léa", stickers: [editionId(AUTUMN_STICKERS[0].id, 2026)] }]), NOW);
    expect(decodeState(valid).ok).toBe(true);
    for (const e of [{ z2026: "AQ" }, { a26: "AQ" }, { a2026: "AQ" }, { a2026: "AQAAAAAB" }, { a2026: 5 }, [], "x"]) {
      expect(decodeState(code({ e })).ok).toBe(false);
    }
  });

  it("keeps the classic mask under 2^20 so v0.8 phones still accept the code", () => {
    const text = encodeState(state([{ id: "p1", name: "Léa", stickers: [...C, ...H] }]), NOW);
    expect(wire(text).p[0].k).toBe(2 ** STICKERS.length - 1);
  });

  it("two-way sync: each child keeps their own seasonal stickers, nothing lost", () => {
    const A = AUTUMN_STICKERS.map((s) => editionId(s.id, 2026));
    let a = state([
      { id: "pA1", name: "Léa", stickers: [...C, H[0], H[1], A[0]] },
      { id: "pA2", name: "Tom", stickers: [C[0], H[2]] },
    ]);
    let b = state([
      { id: "pB1", name: "Léa", stickers: [C[1], H[3], A[55]] },
      { id: "pB2", name: "Tom", stickers: [H[4], H[5], editionId("pumpkin", 2027)] },
    ]);
    b = sync(b, a);
    a = sync(a, b);
    expect(history(a)).toEqual(history(b));
    expect(history(a)["lea"].k).toEqual([...C, H[0], H[1], H[3], A[0], A[55]].sort());
    expect(history(a)["tom"].k).toEqual([C[0], H[2], H[4], H[5], editionId("pumpkin", 2027)].sort());
  });
});
