import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mascotImg from "@/assets/mascot.png";
import { BRUSHING_ZONES, TOTAL_DURATION, ZONE_STARTS, getPhaseAt, getZoneAt } from "@/data/brushingZones";
import BathroomBackground from "./BathroomBackground";
import BubbleTimer from "./BubbleTimer";
import MouthDiagram from "./mouth/MouthDiagram";
import MiniMap from "./mouth/MiniMap";
import { stepInfo } from "./mouth/geometry";
import Countdown from "./Countdown";
import SideMarker from "./SideMarker";
import MuteButton from "./MuteButton";
import MusicButton from "./MusicButton";
import SpeechBubble from "./SpeechBubble";
import { Button } from "@/components/ui/button";
import { isMuted, playPop, playTick, playZoneComplete, subscribeMuted, unlockAudio } from "@/lib/sounds";
import { isMusicOn, startMusic, stopMusic, subscribeMusic } from "@/lib/music";
import { preloadVoice, speak, stopSpeaking } from "@/lib/voice";
import { FINISH_LINE } from "@/data/voiceLines";
import { useWakeLock } from "@/hooks/use-wake-lock";

interface BrushingScreenProps {
  onComplete: () => void;
  onCancel: () => void;
}

const BrushingScreen = ({ onComplete, onCancel }: BrushingScreenProps) => {
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Time accumulated before the current running stretch (survives pauses).
  const accumulatedMsRef = useRef(0);
  const prevZoneRef = useRef(0);
  const prevPhaseRef = useRef(0);
  const completedRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [finished, setFinished] = useState(false);

  useWakeLock(true);

  // Timestamp-based clock: elapsed time is measured, not counted, so late or
  // throttled ticks can't make it drift.
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(accumulatedMsRef.current + Date.now() - startedAt);
    }, 250);
    return () => {
      clearInterval(interval);
      accumulatedMsRef.current += Date.now() - startedAt;
      setElapsedMs(accumulatedMsRef.current);
    };
  }, [paused]);

  // Auto-pause when the app goes to the background (call, home button...).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const elapsed = Math.min(TOTAL_DURATION, Math.floor(elapsedMs / 1000));
  const { index: currentZoneIndex } = getZoneAt(elapsed);
  const currentZone = BRUSHING_ZONES[currentZoneIndex];
  // Fractional seconds into the zone: drives the phase, the brush path and the shine.
  const secondsIntoZone = Math.min(
    currentZone.durationSeconds,
    Math.max(0, elapsedMs / 1000 - ZONE_STARTS[currentZoneIndex]),
  );
  const { phaseIndex, phaseElapsed } = getPhaseAt(currentZoneIndex, secondsIntoZone);
  const currentPhase = currentZone.phases[phaseIndex];

  // At 3:00: a short "everything shines" moment, then the celebration (once).
  useEffect(() => {
    if (elapsed >= TOTAL_DURATION && !completedRef.current) {
      completedRef.current = true;
      setFinished(true);
      finishTimerRef.current = setTimeout(onComplete, 1800);
    }
  }, [elapsed, onComplete]);
  useEffect(() => () => clearTimeout(finishTimerRef.current), []);

  // Chime on zone change, soft "plop" when a step flips to its next view.
  useEffect(() => {
    if (currentZoneIndex !== prevZoneRef.current && currentZoneIndex > 0) {
      playZoneComplete();
    } else if (phaseIndex !== prevPhaseRef.current && phaseIndex > 0) {
      playPop();
    }
    prevZoneRef.current = currentZoneIndex;
    prevPhaseRef.current = phaseIndex;
  }, [currentZoneIndex, phaseIndex]);

  // Quenottes says each instruction when its step/view starts (just after the chime),
  // and "Bravo" at the end. Pausing cuts him off; resuming repeats the instruction.
  const instruction = finished ? FINISH_LINE : currentPhase.instruction;
  useEffect(() => {
    if (paused) {
      stopSpeaking();
      return;
    }
    const id = setTimeout(() => speak(instruction), 400);
    return () => clearTimeout(id);
  }, [instruction, paused]);
  useEffect(() => {
    preloadVoice();
    return () => stopSpeaking();
  }, []);

  // 3-2-1 before every change of step or view, with a soft tick on each number.
  const secondsLeftInPhase = currentPhase.durationSeconds - phaseElapsed;
  const countdown =
    !finished && !paused && secondsLeftInPhase > 0 && secondsLeftInPhase <= 3 ? Math.ceil(secondsLeftInPhase) : null;
  useEffect(() => {
    if (countdown !== null) playTick();
  }, [countdown]);

  const { side } = stepInfo({ zoneIndex: currentZoneIndex, phaseIndex });

  // Background music: follows the session clock (pause/resume stay in sync),
  // reacts to the 🎵 and 🔊 toggles, stops at the end or when leaving.
  const [musicOn, setMusicOnState] = useState(isMusicOn);
  const [muted, setMutedState] = useState(isMuted);
  useEffect(() => subscribeMusic(setMusicOnState), []);
  useEffect(() => subscribeMuted(setMutedState), []);
  const elapsedMsRef = useRef(0);
  elapsedMsRef.current = elapsedMs;
  useEffect(() => {
    if (musicOn && !muted && !paused && !finished) startMusic(elapsedMsRef.current / 1000);
    else stopMusic();
  }, [musicOn, muted, paused, finished]);
  useEffect(() => () => stopMusic(), []);

  const handleResume = () => {
    unlockAudio(true); // the context may have been suspended while in background
    setPaused(false);
  };

  const zoneProgress = secondsIntoZone / currentZone.durationSeconds;
  const remainingTotal = TOTAL_DURATION - elapsed;
  const mins = Math.floor(remainingTotal / 60);
  const secs = remainingTotal % 60;
  const remainingLabel = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <BathroomBackground tint={`hsl(${currentZone.hue} 90% 84% / 0.55)`}>
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-6 gap-3 sm:gap-4">
        {/* Top bar: mute · small parent timer · stop */}
        <div className="w-full max-w-md flex items-center justify-between">
          <div className="flex gap-2">
            <MuteButton />
            <MusicButton />
          </div>
          <p
            className="px-4 py-1 rounded-full bg-white/70 border-2 border-ink/15 text-lg font-display font-semibold text-ink tabular-nums"
            aria-label={`Temps restant ${remainingLabel}`}
          >
            {remainingLabel}
          </p>
          {/* Quit: opens the pause screen instead of cancelling right away */}
          <button
            onClick={() => setPaused(true)}
            className="w-14 h-14 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center text-xl text-ink transition-colors"
            aria-label="Arrêter"
          >
            ✕
          </button>
        </div>

        <BubbleTimer
          currentZoneIndex={currentZoneIndex}
          zoneProgress={zoneProgress}
          totalProgress={elapsed / TOTAL_DURATION}
        />

        {/* The mouth */}
        <div className="relative flex-1 w-full max-w-[400px] flex items-center justify-center">
          <MouthDiagram
            zoneIndex={currentZoneIndex}
            phaseIndex={phaseIndex}
            phaseElapsed={phaseElapsed}
            finished={finished}
          />
          {!finished && (
            <MiniMap step={{ zoneIndex: currentZoneIndex, phaseIndex }} className="absolute top-0 right-0" />
          )}
          {!finished && side !== "front" && <SideMarker key={side} side={side} />}
          <Countdown value={countdown} />
        </div>

        {/* Quenottes explains the current zone */}
        <div className="w-full max-w-md flex items-center gap-3">
          <img src={mascotImg} alt="Quenottes" className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 mascot-bounce drop-shadow-lg" />
          <AnimatePresence mode="wait">
            <motion.div
              key={finished ? "done" : `${currentZoneIndex}-${phaseIndex}`}
              className="flex-1"
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <SpeechBubble>
                <p className="font-display font-semibold text-xl sm:text-2xl leading-snug text-ink">
                  {instruction}
                </p>
              </SpeechBubble>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Encouragement + pause */}
        <motion.p
          className="text-base text-muted-foreground font-body font-semibold italic text-center"
          key={Math.floor(elapsed / 15)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {getEncouragement(elapsed)}
        </motion.p>
        <button
          onClick={() => setPaused(true)}
          className="w-16 h-16 rounded-full bg-white border-[3px] border-ink shadow-[0_5px_0_hsl(var(--ink)/0.25)] active:translate-y-1 active:shadow-none flex items-center justify-center transition-[transform,box-shadow]"
          aria-label="Pause"
        >
          <span className="flex gap-1.5" aria-hidden>
            <span className="w-2.5 h-7 rounded-full bg-ink" />
            <span className="w-2.5 h-7 rounded-full bg-ink" />
          </span>
        </button>
      </div>

      {/* Pause screen: resuming is the default, stopping is a deliberate second tap */}
      <AnimatePresence>
        {paused && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
          >
            <motion.div
              className="w-full max-w-sm flex flex-col items-center gap-4 bg-white border-[3px] border-ink rounded-[2rem] px-6 pt-6 pb-8 shadow-[0_8px_0_hsl(var(--ink)/0.2)]"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <img src={mascotImg} alt="" className="w-28 h-28 drop-shadow-lg" />
              <h2 id="pause-title" className="text-4xl font-display font-bold sticker-title">
                Pause
              </h2>
              <p className="text-lg text-muted-foreground font-body font-semibold text-center">
                Quenottes t'attend ! Encore {remainingLabel} de brossage.
              </p>
              <Button variant="hero" size="lg" onClick={handleResume} autoFocus className="mt-2">
                ▶ Continuer
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Arrêter
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BathroomBackground>
  );
};

function getEncouragement(elapsed: number): string {
  const messages = [
    "Tu te débrouilles super bien\u00A0! 🌟",
    "Continue comme ça, champion\u00A0! 💪",
    "Tes dents vont briller\u00A0! ✨",
    "Quenottes est fier de toi\u00A0! 😊",
    "Tu es un pro du brossage\u00A0! 🏆",
    "Encore un peu, courage\u00A0! 🎉",
    "Super travail\u00A0! 👏",
    "Les microbes n'ont qu'à bien se tenir\u00A0! 🦠💨",
    "Tes dents te disent merci\u00A0! 🦷❤️",
    "Presque fini, bravo\u00A0! 🎊",
    "Tu es une star du brossage\u00A0! ⭐",
    "Magnifique technique\u00A0! 👌",
  ];
  const index = Math.floor(elapsed / 15) % messages.length;
  return messages[index];
}

export default BrushingScreen;
