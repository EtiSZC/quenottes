import { useState } from "react";
import { motion } from "framer-motion";
import BathroomBackground from "@/components/BathroomBackground";
import { albumPages, displayName, getActiveProfiles, getProfile, listProfiles, placeInGrid, type AlbumPage, type Sticker } from "@/lib/progress";
import { cn } from "@/lib/utils";

interface StickerAlbumProps {
  onBack: () => void;
  /** Injectable for tests (which season is running). */
  now?: Date;
}

type Look = "classic" | "halloween" | "autumn";
const lookOf = (page: AlbumPage): Look => page.season?.id ?? "classic";

/** Colours per page: classics on the bathroom background, each season on its own card. */
const LOOK = {
  classic: {
    box: "",
    title: "text-ink",
    hint: "text-ink/70",
    bar: "bg-white/85 border-ink/20",
    barTitle: "text-ink",
    barNote: "text-ink/70",
    has: "bg-white border-[3px] border-ink shadow-[0_4px_0_hsl(var(--ink)/0.15)]",
    missing: "bg-white/40 border-[3px] border-dashed border-ink/25",
  },
  halloween: {
    box: "bg-[#2B1B4A] border-ink",
    title: "text-[#FFB067]",
    hint: "text-white/80",
    bar: "bg-[#2B1B4A] border-ink",
    barTitle: "text-[#FFB067]",
    barNote: "text-white/85",
    has: "bg-white border-[3px] border-[#FF8A3D] shadow-[0_0_12px_#FF8A3D]",
    missing: "bg-white/10 border-[3px] border-dashed border-white/30",
  },
  autumn: {
    box: "bg-[#FFF1DE] border-ink",
    title: "text-[#7A3E12]",
    hint: "text-[#7A3E12]/80",
    bar: "bg-[#FFF1DE] border-ink",
    barTitle: "text-[#7A3E12]",
    barNote: "text-[#7A3E12]/85",
    has: "bg-white border-[3px] border-[#E07B22] shadow-[0_0_12px_#E07B2266]",
    missing: "bg-[#E07B22]/10 border-[3px] border-dashed border-[#E07B22]/40",
  },
} as const;

const PLACEHOLDER: Record<Look, string> = { classic: "?", halloween: "🎃", autumn: "🍂" };
const HINT: Partial<Record<Look, string>> = {
  halloween: "Seulement pendant Halloween\u00A0!",
  autumn: "Jusqu'au 30 novembre\u00A0!",
};

const Grid = ({ page, look, seed }: { page: AlbumPage; look: Look; seed: string }) => {
  // A long grid (« Automne en forêt »): the first 20 stickers land in scattered boxes (like the classics,
  // where each sticker has its own place), the next ones fill the added rows in order.
  const cells: (Sticker | null)[] = page.slotted
    ? placeInGrid(page.won, page.total, `${seed}-${page.key}`).map((k) =>
        k === null ? null : (page.stickers.find((s) => s.id === page.earnedOrder[k]) ?? null),
      )
    : page.stickers.map((s) => (page.earned.has(s.id) ? s : null));
  return (
    <ul className="grid grid-cols-4 gap-3">
      {cells.map((s, i) => (
        <motion.li
          key={s?.id ?? `empty-${i}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(i, 20) * 0.02 }}
          className={cn("aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5", s ? LOOK[look].has : LOOK[look].missing)}
          aria-label={s ? s.name : "Autocollant à gagner"}
        >
          {s ? (
            <>
              <span className="text-4xl leading-none">{s.emoji}</span>
              <span className="text-[11px] leading-tight text-center font-body font-semibold text-ink/70">{s.name}</span>
            </>
          ) : look === "classic" ? (
            <span className="font-display font-bold text-ink/30 text-3xl leading-none">?</span>
          ) : (
            <span className="text-3xl leading-none opacity-30 grayscale">{PLACEHOLDER[look]}</span>
          )}
        </motion.li>
      ))}
    </ul>
  );
};

/**
 * The sticker collection. The grid being played now is open at the top with every box; all the
 * others (finished classics, past or finished seasonal editions) are folded at the bottom and
 * open on a tap, so a child can still look at what they won.
 */
const StickerAlbum = ({ onBack, now = new Date() }: StickerAlbumProps) => {
  const profiles = listProfiles();
  const [profileId, setProfileId] = useState(() => getActiveProfiles()[0].id);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const pages = albumPages(getProfile(profileId).stickers, now);
  const won = pages.reduce((n, p) => n + p.won, 0);
  const total = pages.reduce((n, p) => n + p.total, 0);
  const toggle = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <BathroomBackground>
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-24 gap-4">
        <div className="w-full max-w-md flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-14 h-14 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center text-2xl text-ink"
            aria-label="Retour"
          >
            ←
          </button>
          <h1 className="text-4xl font-display font-bold sticker-title">Mon album</h1>
          <span className="w-14 text-right font-display font-bold text-lg text-ink" aria-label={`${won} autocollants sur ${total}`}>
            {won}/{total}
          </span>
        </div>

        {/* One album per child */}
        {profiles.length > 1 && (
          <div className="w-full max-w-md flex justify-center gap-2" role="tablist" aria-label="Album de">
            {profiles.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === profileId}
                onClick={() => setProfileId(p.id)}
                className={cn(
                  "h-12 px-3 rounded-full border-[3px] flex items-center gap-1.5 font-display font-bold text-ink",
                  p.id === profileId ? "bg-mint border-ink" : "bg-white/70 border-ink/15",
                )}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {p.avatar}
                </span>
                <span className="max-w-[5rem] truncate">{displayName(p)}</span>
              </button>
            ))}
          </div>
        )}

        {pages.map((page) => {
          const look = lookOf(page);
          const colours = LOOK[look];
          const key = `${profileId}-${page.key}`;
          const icon = page.season?.id === "halloween" ? ["🎃 ", " 🦇"] : page.season?.id === "autumn" ? ["🍂 ", ""] : ["", ""];
          const title = `${icon[0]}${page.title}${icon[1]}`;
          const counter = (
            <span className="text-base" aria-label={`${page.won} sur ${page.total}`}>
              {page.won}/{page.total}
            </span>
          );

          if (page.current) {
            return (
              <section
                key={key}
                aria-label={page.title}
                className={cn("w-full max-w-md flex flex-col gap-3", look !== "classic" && "rounded-3xl p-3 border-[3px]", colours.box)}
              >
                <h2 className={cn("flex items-center justify-between font-display font-bold text-xl px-1", colours.title)}>
                  <span>{title}</span>
                  {counter}
                </h2>
                {HINT[look] && <p className={cn("px-1 -mt-2 text-sm font-body font-semibold", colours.hint)}>{HINT[look]}</p>}
                <Grid page={page} look={look} seed={profileId} />
              </section>
            );
          }

          const open = opened.has(key);
          const panel = `${key}-grid`;
          return (
            <section
              key={key}
              aria-label={page.title}
              className={cn("w-full max-w-md flex flex-col gap-3 rounded-3xl border-[3px] p-3", colours.bar)}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={open}
                aria-controls={panel}
                className="w-full min-h-12 flex flex-col gap-0.5 text-left"
              >
                <span className={cn("flex items-center justify-between font-display font-bold text-xl", colours.barTitle)}>
                  <span>{title}</span>
                  <span className="flex items-center gap-2">
                    {counter}
                    <span aria-hidden>{open ? "▴" : "▾"}</span>
                  </span>
                </span>
                {page.note && <span className={cn("text-sm font-body font-semibold", colours.barNote)}>{page.note}</span>}
              </button>
              {open && (
                <div id={panel}>
                  <Grid page={page} look={look} seed={profileId} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </BathroomBackground>
  );
};

export default StickerAlbum;
