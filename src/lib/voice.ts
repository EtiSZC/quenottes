import { QueueStrategy, TextToSpeech } from "@capacitor-community/text-to-speech";
import manifest from "@/data/voice-manifest.json";
import { isMuted, loadClip, playClip, stopClip, subscribeMuted } from "./sounds";

// Brillou's voice: pre-recorded ElevenLabs clips (public/voice, see
// scripts/generate-voice.mjs). Any sentence without a clip falls back to the
// phone's text-to-speech (native on Android; speechSynthesis in a browser).

const CLIPS: Record<string, string> = manifest;
const clipUrl = (file: string) => `${import.meta.env.BASE_URL}voice/${file}`;

// Increments on every speak/stop: only the latest request may produce sound.
let speechToken = 0;

function speakWithDevice(text: string) {
  try {
    TextToSpeech.speak({
      text: text.replace(/\u00A0/g, " "),
      lang: "fr-FR",
      rate: 0.95,
      pitch: 1.15,
      volume: 1,
      queueStrategy: QueueStrategy.Flush,
    }).catch(() => {});
  } catch {
    // No speech engine available: the app keeps working without voice.
  }
}

/** Rough speaking time of a sentence, used when nothing audible plays (muted, device voice). */
const estimateMs = (text: string) => Math.max(1200, text.length * 65);

// Promises of the sentences being spoken, so they can be settled when speech is cut.
const waiters = new Set<(finished: boolean) => void>();
function settleWaiters(finished: boolean) {
  waiters.forEach((resolve) => resolve(finished));
  waiters.clear();
}

/**
 * Say a sentence in French, cutting off anything Brillou was still saying.
 * Resolves true when the sentence is over (the clip ended, or its estimated time passed when
 * nothing audible plays, e.g. muted), false if a newer sentence or stopSpeaking() cut it off.
 */
export function speak(text: string): Promise<boolean> {
  settleWaiters(false);
  const token = ++speechToken;
  return new Promise<boolean>((resolve) => {
    waiters.add(resolve);
    const finish = () => {
      waiters.delete(resolve);
      resolve(token === speechToken);
    };
    const finishAfterEstimate = () => void window.setTimeout(finish, estimateMs(text));
    if (isMuted()) {
      finishAfterEstimate();
      return;
    }
    const file = CLIPS[text];
    if (!file) {
      speakWithDevice(text);
      finishAfterEstimate();
      return;
    }
    playClip(clipUrl(file), () => token === speechToken, finish).then((played) => {
      if (token !== speechToken) return; // cut off: the waiter was already settled
      if (!played) {
        speakWithDevice(text);
        finishAfterEstimate();
      }
    });
  });
}

function silence() {
  stopClip();
  try {
    TextToSpeech.stop().catch(() => {});
  } catch {
    // Nothing to stop.
  }
}

export function stopSpeaking() {
  speechToken++;
  settleWaiters(false);
  silence();
}

/** Load every clip ahead of time so the first sentences play without delay. */
export function preloadVoice() {
  Object.values(CLIPS).forEach((file) => void loadClip(clipUrl(file)));
}

// Muting silences a sentence already in progress; whoever waits for it moves on (the time is over).
subscribeMuted((muted) => {
  if (muted) {
    silence();
    settleWaiters(true);
  }
});
