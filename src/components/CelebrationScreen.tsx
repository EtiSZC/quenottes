import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import mascotCelebrateImg from "@/assets/mascot-celebrate.png";
import { Button } from "@/components/ui/button";
import BathroomBackground from "@/components/BathroomBackground";
import { playFanfare, playStarSound } from "@/lib/sounds";
import { speak, stopSpeaking } from "@/lib/voice";
import { CELEBRATION_LINE, CELEBRATION_LINE_TOGETHER } from "@/data/voiceLines";
import { joinNames, type ProfileSessionResult } from "@/lib/progress";


interface CelebrationScreenProps {
  /** What this session earned, one entry per child who brushed (several = together). */
  results: ProfileSessionResult[];
  /** Ends the moment and goes home ("À ce soir !" / "À demain !"). */
  onDone: () => void;
  onAlbum: () => void;
}

const CelebrationScreen = ({ results, onDone, onAlbum }: CelebrationScreenProps) => {
  const evening = results[0]?.slot === "evening";
  const together = results.length > 1;
  const names = joinNames(results.map((r) => r.profile));
  const hasPlayed = useRef(false);
  const speakTimer = useRef<ReturnType<typeof setTimeout>>();
  // Fixed for the lifetime of this screen (the sounds effect below runs once).
  const celebrationLine = useRef(together ? CELEBRATION_LINE_TOGETHER : CELEBRATION_LINE);

  useEffect(() => {
    if (hasPlayed.current) return;
    hasPlayed.current = true;

    // Sound
    playFanfare();
    setTimeout(() => playStarSound(), 800);
    setTimeout(() => playStarSound(), 1200);
    speakTimer.current = setTimeout(() => speak(celebrationLine.current), 1500);

    // Confetti bursts
    const fire = (opts: confetti.Options) => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#3CCFB4", "#FF7EB6", "#FFD23F", "#7EC8E3", "#FFFFFF"],
        disableForReducedMotion: true,
        ...opts,
      });
    };

    fire({ angle: 60, origin: { x: 0, y: 0.7 } });
    fire({ angle: 120, origin: { x: 1, y: 0.7 } });

    setTimeout(() => {
      fire({ angle: 90, origin: { x: 0.5, y: 0.8 }, particleCount: 120, spread: 100 });
    }, 600);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(speakTimer.current); // leaving early: don't talk over the next screen
      stopSpeaking();
    },
    [],
  );

  return (
    <BathroomBackground tint="hsl(46 100% 80% / 0.45)">
      <div className="flex flex-col items-center justify-center flex-1 px-6 pt-8 pb-20">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 12 }}
        >
          <img
            src={mascotCelebrateImg}
            alt="Brillou célèbre"
            className="w-40 h-40 sm:w-52 sm:h-52 mascot-celebrate drop-shadow-xl"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-5xl sm:text-6xl font-display font-bold text-center mt-2 mb-2 sticker-title"
        >
          {names ? `Bravo ${names}\u00A0!` : "Bravo\u00A0! 🎉"}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-lg sm:text-xl text-muted-foreground font-body font-semibold text-center mb-4 max-w-xs"
        >
          {together ? "Vos" : "Tes"} dents sont toutes propres et brillantes ! ✨🦷
        </motion.p>

        {results.some((r) => r.newSticker) ? (
          // New sticker(s) flip in like cards — one per child when brushing together
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {results.map((r, i) => (
              <motion.div
                key={r.profile.id}
                className={
                  "flex flex-col items-center gap-1 bg-white border-[3px] rounded-3xl " +
                  (r.season === "halloween"
                    ? "border-[#FF8A3D] shadow-[0_0_18px_#FF8A3D] "
                    : r.season === "autumn"
                      ? "border-[#E07B22] shadow-[0_0_18px_#E07B22] "
                      : "border-ink shadow-[0_6px_0_hsl(var(--ink)/0.18)] ") +
                  (together ? "px-3 py-3 w-[44%] max-w-[10rem]" : "px-8 py-4")
                }
                initial={{ rotateY: 180, scale: 0.6, opacity: 0 }}
                animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                transition={{ delay: 1.1 + i * 0.25, type: "spring", stiffness: 120, damping: 12 }}
                style={{ transformPerspective: 800 }}
              >
                <span className="font-display font-semibold text-sm text-ink/70 text-center">
                  {together ? `${r.profile.avatar} ${r.profile.name || "Moi"}` : "Nouvel autocollant !"}
                </span>
                {r.newSticker ? (
                  <>
                    <span className={(together ? "text-5xl" : "text-6xl") + " leading-none sparkle"} aria-hidden>
                      {r.newSticker.emoji}
                    </span>
                    <span className="font-display font-bold text-lg text-ink">{r.newSticker.name}</span>
                    {r.season === "halloween" && (
                      <span className="text-xs font-display font-bold text-[#C2410C]">🎃 Halloween</span>
                    )}
                    {r.season === "autumn" && (
                      <span className="text-xs font-display font-bold text-[#B45309]">🍂 Automne en forêt</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-body font-semibold text-muted-foreground text-center">
                    Déjà gagné {evening ? "ce soir" : "ce matin"} 😉
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
            className="flex flex-col items-center gap-2 mb-6"
          >
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <motion.span
                  key={i}
                  className="text-5xl sparkle drop-shadow-md"
                  style={{ animationDelay: `${i * 0.3}s` }}
                  initial={{ rotate: -30, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 1 + i * 0.2, type: "spring" }}
                >
                  ⭐
                </motion.span>
              ))}
            </div>
            {results.length > 0 && (
              <p className="text-sm text-muted-foreground font-body font-semibold text-center max-w-xs">
                Tu as déjà ton autocollant {evening ? "de ce soir" : "de ce matin"} 😉
              </p>
            )}
          </motion.div>
        )}

        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.4, type: "spring" }}
        >
          <Button variant="secondary" size="lg" onClick={onDone}>
            {evening ? "🌙 À demain !" : "☀️ À ce soir !"}
          </Button>
          <Button variant="outline" onClick={onAlbum}>
            📒 Mon album
          </Button>
        </motion.div>
      </div>
    </BathroomBackground>
  );
};

export default CelebrationScreen;
