import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import mascotImg from "@/assets/mascot.png";
import BathroomBackground from "@/components/BathroomBackground";
import MuteButton from "@/components/MuteButton";
import SpeechBubble from "@/components/SpeechBubble";
import ToothpasteQuantity, { type TipStage } from "@/components/illustrations/ToothpasteQuantity";
import {
  TIP_ANNOUNCE,
  TIP_FOOTNOTE,
  TIP_OPEN_LINE,
  TIP_PEA_LINE,
  TIP_SCENE_LABEL,
  TIP_SPIT_LINE,
  TIP_TITLE,
  TIP_TOO_MUCH_BUTTON,
  TIP_TOO_MUCH_LINE,
} from "@/data/toothpasteTip";
import { speak, stopSpeaking } from "@/lib/voice";
import { playPop } from "@/lib/sounds";

interface ToothpasteTipScreenProps {
  onBack: () => void;
}

/** How long the oversized blob stays before the pea comes back. */
const BLOB_MS = 2500;
/** Pause between the opening line and the squeeze, between the squeeze and the drop, etc. */
const BEAT_MS = 300;
const SQUEEZE_MS = 800;
/** From the start of the drop to the pea touching the bristles (sound + bubble text). */
const LAND_MS = 450;
const SETTLE_MS = 250;

/**
 * « Le petit pois »: an optional page (never inside the brushing flow) that shows how much
 * toothpaste to use, all by itself and without any touch: the mascot says the headline, the
 * pink tube slides in and squeezes a pea onto the brush, the mascot confirms and reminds to
 * spit. Only ← and 🔊 (and « Trop ? » once it is over) can be pressed. No score, timer or red.
 */
const ToothpasteTipScreen = ({ onBack }: ToothpasteTipScreenProps) => {
  const reduced = useReducedMotion() ?? false;
  const [stage, setStage] = useState<TipStage>("idle");
  const [landed, setLanded] = useState(false);
  const [done, setDone] = useState(false);
  const [blob, setBlob] = useState(false);
  const timers = useRef<number[]>([]);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, ms));
    });

  // The whole sequence, driven by the end of each spoken line. Leaving the page cancels it.
  useEffect(() => {
    let cancelled = false;
    const live = () => !cancelled;
    (async () => {
      if (!reduced) setStage("arrive");
      await speak(TIP_OPEN_LINE);
      if (!live()) return;
      await sleep(BEAT_MS);
      if (!live()) return;
      if (reduced) {
        setStage("drop"); // the pea just fades in
        await sleep(SETTLE_MS);
      } else {
        setStage("squeeze");
        await sleep(SQUEEZE_MS);
        if (!live()) return;
        setStage("drop");
        await sleep(LAND_MS);
        if (!live()) return;
        playPop();
        await sleep(SETTLE_MS);
      }
      if (!live()) return;
      setStage("leave");
      setLanded(true);
      await speak(TIP_PEA_LINE);
      if (!live()) return;
      await sleep(BEAT_MS);
      if (!live()) return;
      await speak(TIP_SPIT_LINE);
      if (!live()) return;
      setDone(true);
    })();
    const onHidden = () => {
      if (document.hidden) stopSpeaking();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHidden);
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      stopSpeaking();
    };
    // The sequence runs once per visit; `reduced` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTooMuch = () => {
    setBlob(true);
    speak(TIP_TOO_MUCH_LINE);
    timers.current.push(window.setTimeout(() => setBlob(false), BLOB_MS));
  };

  const bubble = blob ? TIP_TOO_MUCH_LINE : landed ? TIP_PEA_LINE : TIP_OPEN_LINE;
  const announce = blob ? TIP_ANNOUNCE.blob : landed ? TIP_ANNOUNCE.pea : TIP_ANNOUNCE.empty;

  return (
    <BathroomBackground>
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-10 gap-3">
        <div className="w-full max-w-md flex items-center justify-between">
          <button
            onClick={() => {
              stopSpeaking();
              onBack();
            }}
            className="w-14 h-14 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center text-2xl text-ink"
            aria-label="Retour"
          >
            ←
          </button>
          <h1 className="text-4xl font-display font-bold sticker-title">{TIP_TITLE}</h1>
          <MuteButton />
        </div>

        <SpeechBubble tail="bottom" className="mt-1 min-h-[86px] flex items-center justify-center">
          <p className="font-display font-semibold text-xl text-ink text-center">{bubble}</p>
        </SpeechBubble>

        {/* The mascot is a picture, not a button: nothing to touch on this page except ← and 🔊 */}
        <motion.img
          src={mascotImg}
          alt="Quenottes la mascotte"
          className="w-28 h-28 drop-shadow-xl select-none pointer-events-none"
          draggable={false}
          animate={reduced ? undefined : { scale: blob ? 1.08 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
        />

        <div
          role="img"
          aria-label={TIP_SCENE_LABEL}
          className="w-full max-w-md rounded-3xl bg-white border-[3px] border-ink shadow-[0_5px_0_hsl(var(--ink)/0.15)] px-3 py-2 pointer-events-none overflow-hidden"
        >
          <ToothpasteQuantity stage={stage} blob={blob} reduced={reduced} />
        </div>

        <button
          onClick={showTooMuch}
          disabled={!done || blob}
          className="h-14 min-w-14 px-6 rounded-full bg-white border-[3px] border-ink shadow-[0_4px_0_hsl(var(--ink)/0.15)] font-display font-bold text-xl text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/40 disabled:opacity-50"
        >
          {TIP_TOO_MUCH_BUTTON}
        </button>

        <p className="w-full max-w-md text-sm font-body font-semibold text-ink/80 text-center">{TIP_FOOTNOTE}</p>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </BathroomBackground>
  );
};

export default ToothpasteTipScreen;
