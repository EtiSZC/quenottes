import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import mascotImg from "@/assets/mascot.png";
import BathroomBackground from "@/components/BathroomBackground";
import MuteButton from "@/components/MuteButton";
import SpeechBubble from "@/components/SpeechBubble";
import ToothpasteQuantity, { type PasteState } from "@/components/illustrations/ToothpasteQuantity";
import {
  TIP_ANNOUNCE,
  TIP_FOOTNOTE,
  TIP_HINT,
  TIP_OPEN_LINE,
  TIP_PEA_LINE,
  TIP_POD_CAPTION,
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
/** Pause between « Parfait ! » and the « on crache » line (the first clip lasts about 2 s). */
const SPIT_DELAY_MS = 2600;

const BUBBLE_TEXT: Record<PasteState, string> = {
  empty: TIP_OPEN_LINE,
  pea: TIP_PEA_LINE,
  blob: TIP_TOO_MUCH_LINE,
};

/** A green pod with three peas: the real-world reference for « un petit pois ». */
const Pod = () => (
  <svg viewBox="0 0 64 28" className="w-16 h-7 shrink-0" aria-hidden>
    <ellipse cx="32" cy="14" rx="30" ry="11" className="fill-[#8BD35C] stroke-ink" strokeWidth="2.5" />
    {[18, 32, 46].map((x) => (
      <circle key={x} cx={x} cy="14" r="6" className="fill-[#B6EC8A] stroke-ink" strokeWidth="2" />
    ))}
  </svg>
);

/**
 * « Le petit pois »: an optional page (never inside the brushing flow) that shows how much
 * toothpaste to use. Brillou says it out loud once on opening, then only when tapped. No score,
 * no timer, no red: the oversized blob is just something to compare with.
 */
const ToothpasteTipScreen = ({ onBack }: ToothpasteTipScreenProps) => {
  const reduced = useReducedMotion() ?? false;
  const [state, setState] = useState<PasteState>("empty");
  const [pops, setPops] = useState(0);
  const [touched, setTouched] = useState(false);
  const timers = useRef<number[]>([]);
  const spitSaid = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Say the headline once (the tap that opened this page unlocked the audio); stop on leave.
  useEffect(() => {
    speak(TIP_OPEN_LINE);
    const onHidden = () => {
      if (document.hidden) {
        clearTimers();
        stopSpeaking();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      clearTimers();
      stopSpeaking();
    };
  }, [clearTimers]);

  const tapBrush = () => {
    clearTimers();
    setTouched(true);
    setPops((n) => n + 1);
    playPop();
    if (state === "pea") {
      setState("empty");
      return;
    }
    setState("pea");
    speak(TIP_PEA_LINE);
    if (!spitSaid.current) {
      spitSaid.current = true;
      later(() => speak(TIP_SPIT_LINE), SPIT_DELAY_MS);
    }
  };

  const showTooMuch = () => {
    clearTimers();
    setTouched(true);
    setState("blob");
    speak(TIP_TOO_MUCH_LINE);
    later(() => {
      setPops((n) => n + 1);
      setState("pea");
    }, BLOB_MS);
  };

  const replay = () => {
    clearTimers();
    speak(BUBBLE_TEXT[state]);
  };

  return (
    <BathroomBackground>
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-10 gap-3">
        <div className="w-full max-w-md flex items-center justify-between">
          <button
            onClick={() => {
              clearTimers();
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

        <SpeechBubble tail="bottom" className="mt-1">
          <p className="font-display font-semibold text-xl text-ink text-center">{BUBBLE_TEXT[state]}</p>
        </SpeechBubble>

        <button onClick={replay} className="rounded-full" aria-label="Réécouter Brillou">
          <motion.img
            src={mascotImg}
            alt="Brillou la mascotte"
            className="w-28 h-28 drop-shadow-xl"
            animate={reduced ? undefined : { scale: state === "blob" ? 1.08 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
          />
        </button>

        <button
          onClick={tapBrush}
          aria-pressed={state === "pea"}
          aria-label="Mettre un petit pois de dentifrice sur la brosse"
          className="w-full max-w-md min-h-40 rounded-3xl bg-white border-[3px] border-ink shadow-[0_5px_0_hsl(var(--ink)/0.15)] px-3 py-4 flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/40"
        >
          <ToothpasteQuantity state={state} hint={!touched} pops={pops} reduced={reduced} />
          <span className="font-display font-semibold text-xl text-ink/80 h-7">{!touched ? TIP_HINT : ""}</span>
        </button>

        <div className="w-full max-w-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-display font-semibold text-xl text-ink">
            <Pod />
            <span>= {TIP_POD_CAPTION}</span>
          </div>
          <button
            onClick={showTooMuch}
            disabled={state === "blob"}
            className="h-14 min-w-14 px-5 rounded-full bg-white border-[3px] border-ink shadow-[0_4px_0_hsl(var(--ink)/0.15)] font-display font-bold text-xl text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/40 disabled:opacity-60"
          >
            {TIP_TOO_MUCH_BUTTON}
          </button>
        </div>

        <p className="w-full max-w-md text-sm font-body font-semibold text-ink/80 text-center">{TIP_FOOTNOTE}</p>
        <p role="status" aria-live="polite" className="sr-only">
          {TIP_ANNOUNCE[state]}
        </p>
      </div>
    </BathroomBackground>
  );
};

export default ToothpasteTipScreen;
