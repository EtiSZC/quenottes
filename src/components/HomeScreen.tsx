import { useMemo } from "react";
import { motion } from "framer-motion";
import mascotImg from "@/assets/mascot.png";
import { Button } from "@/components/ui/button";
import AppTitle from "@/components/AppTitle";
import BathroomBackground from "@/components/BathroomBackground";
import MuteButton from "@/components/MuteButton";
import SpeechBubble from "@/components/SpeechBubble";
import WeekCalendar from "@/components/WeekCalendar";
import ToothpasteTubeIcon from "@/components/illustrations/ToothpasteTubeIcon";
import LongPressButton from "@/components/LongPressButton";
import { albumPages, displayName, getActiveProfiles, getProfile, listProfiles, isAutumnSeason, isHalloweenSeason, streakOf, weekOf } from "@/lib/progress";
import { playStartSound, unlockAudio } from "@/lib/sounds";

interface HomeScreenProps {
  onStart: () => void;
  onAlbum: () => void;
  /** Opens the « petit pois » toothpaste tip. */
  onTip: () => void;
  /** Change who is brushing (shown with 2+ profiles). */
  onSwitch: () => void;
  onParents: () => void;
}

const HomeScreen = ({ onStart, onAlbum, onTip, onSwitch, onParents }: HomeScreenProps) => {
  // Read once per visit to the home screen (the history only changes after a session).
  const { kids, multiProfile } = useMemo(() => {
    const now = new Date();
    const kids = getActiveProfiles().map((meta) => {
      const history = getProfile(meta.id);
      const pages = albumPages(history.stickers, now);
      return {
        meta,
        week: weekOf(history.sessions, now),
        streak: streakOf(history.sessions, now),
        stickerCount: pages.reduce((n, pg) => n + pg.won, 0),
        stickerTotal: pages.reduce((n, pg) => n + pg.total, 0),
      };
    });
    return { kids, multiProfile: listProfiles().length >= 2 };
  }, []);
  const together = kids.length > 1;
  const { week, streak, stickerCount, stickerTotal } = kids[0];
  const greeting = together
    ? "On brosse tous ensemble\u00A0?"
    : kids[0].meta.name
      ? `On brosse ensemble, ${kids[0].meta.name}\u00A0?`
      : "On brosse ensemble\u00A0?";

  const handleStart = () => {
    unlockAudio(true); // inside the tap: fresh context + media session, so guidance is never mute on iOS
    playStartSound();
    onStart();
  };

  const handleTip = () => {
    unlockAudio(); // the tip speaks as soon as it opens
    onTip();
  };

  return (
    <BathroomBackground>
      <div className="relative flex flex-col items-center justify-center flex-1 px-6 pt-20 pb-20">
        <MuteButton className="absolute top-4 left-4" />
        <button
          onClick={onAlbum}
          className="absolute top-4 right-4 w-14 h-14 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center text-2xl"
          aria-label={`Mon album : ${stickerCount} autocollants sur ${stickerTotal}`}
        >
          📒
          {stickerCount > 0 && (
            <span className="absolute -bottom-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-bubblegum border-2 border-ink text-xs font-display font-bold text-ink flex items-center justify-center">
              {stickerCount}
            </span>
          )}
        </button>

        {/* Who is brushing (tap to change) */}
        {multiProfile && (
          <button
            onClick={onSwitch}
            className="absolute top-5 left-1/2 -translate-x-1/2 h-12 px-4 rounded-full bg-white border-[3px] border-ink shadow-[0_4px_0_hsl(var(--ink)/0.15)] flex items-center gap-2 font-display font-bold text-ink max-w-[50%]"
            aria-label={`Changer d'enfant (actuellement ${kids.map((k) => displayName(k.meta)).join(" et ")})`}
          >
            <span className="text-2xl leading-none">{kids.map((k) => k.meta.avatar).join("")}</span>
            {!together && <span className="truncate">{displayName(kids[0].meta)}</span>}
            <span aria-hidden>▾</span>
          </button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 18 }}
        >
          <SpeechBubble tail="bottom" className="mb-3">
            <p className="font-display font-semibold text-xl text-ink">{greeting}</p>
          </SpeechBubble>
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-2"
        >
          <img
            src={mascotImg}
            alt="Quenottes la mascotte"
            className="w-40 h-40 sm:w-52 sm:h-52 mascot-bounce drop-shadow-xl"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="relative text-5xl sm:text-6xl font-display font-bold text-center mb-3 sticker-title"
        >
          <AppTitle />
          {(isHalloweenSeason() || isAutumnSeason()) && (
            <span aria-hidden className="absolute -top-7 -right-3 text-4xl rotate-12">
              {isHalloweenSeason() ? "🎃" : "🍂"}
            </span>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="text-lg sm:text-xl text-muted-foreground font-body font-semibold text-center mb-5 max-w-xs"
        >
          3 minutes pour des dents qui brillent{"\u00A0"}!{"\u00A0"}✨
        </motion.p>

        <motion.div
          className="w-full flex justify-center mb-7"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          {together ? (
            // Brushing together: one compact line per child instead of several calendars
            <ul className="w-full max-w-sm flex flex-col gap-2">
              {kids.map((k) => {
                const thisWeek = k.week.reduce((n, d) => n + Number(d.morning) + Number(d.evening), 0);
                return (
                  <li
                    key={k.meta.id}
                    className="flex items-center gap-3 bg-white/90 border-[3px] border-ink rounded-2xl px-3 py-2 font-display font-semibold text-ink"
                  >
                    <span className="text-3xl leading-none" aria-hidden>
                      {k.meta.avatar}
                    </span>
                    <span className="flex-1 truncate">{displayName(k.meta)}</span>
                    {k.streak > 0 && <span>🔥 {k.streak}</span>}
                    <span className="text-sm text-ink/70">
                      {thisWeek} cette semaine
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <WeekCalendar week={week} streak={streak} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
        >
          <div className="breathe">
            <Button variant="hero" size="xl" onClick={handleStart}>
              🪥 C'est parti !
            </Button>
          </div>
        </motion.div>
        <button
          onClick={handleTip}
          className="absolute bottom-5 left-4 w-14 h-14 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center"
          aria-label="Le petit pois de dentifrice"
        >
          <ToothpasteTubeIcon className="w-10 h-10" />
        </button>
        <LongPressButton
          onLongPress={onParents}
          label="Espace parents : maintenir 2 secondes"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 h-9 text-sm"
        >
          ⚙︎ Parents
        </LongPressButton>
      </div>
    </BathroomBackground>
  );
};

export default HomeScreen;
