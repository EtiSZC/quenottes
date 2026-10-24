// Simple sound synthesis - no external dependencies needed.
// A single shared AudioContext is used: browsers (Safari especially) cap how many
// can exist, and iOS only lets a context play once it was resumed inside a user tap.

const MUTE_KEY = "brosse-brille:muted";

let ctx: AudioContext | null = null;
let muted = readMuted();
const muteListeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (!ctx) {
    // Older Safari only exposes the prefixed constructor.
    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** The shared context (created/resumed on demand), or null without Web Audio. */
export const getAudioContext = (): AudioContext | null => getCtx();

/** Call from a user gesture (tap) so later, timer-driven sounds are allowed on iOS. */
export function unlockAudio() {
  // iPhone (Safari 16.4+/17): play like a media app, so the silent switch doesn't mute
  // Lily and the music. No-op where the Audio Session API doesn't exist (Android, desktop).
  const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (audioSession) {
    try {
      audioSession.type = "playback";
    } catch {
      // Not allowed in this context: keep the default behaviour.
    }
  }
  const c = getCtx();
  if (!c) return;
  // Playing a silent one-sample buffer inside the gesture fully unlocks iOS Safari.
  const buffer = c.createBuffer(1, 1, 22050);
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(c.destination);
  source.start(0);
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode): keep the in-memory value only.
  }
  muteListeners.forEach((listener) => listener(value));
}

export function subscribeMuted(listener: (muted: boolean) => void) {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', startTime = 0) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.connect(gain);
  gain.connect(c.destination);

  osc.type = type;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0.15, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + startTime + duration);

  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration);
}

// ---------------------------------------------------------------------------
// Pre-recorded clips (Brillou's voice), played on the same unlocked context
// ---------------------------------------------------------------------------

const clipCache = new Map<string, Promise<AudioBuffer | null>>();
let currentClip: AudioBufferSourceNode | null = null;
const clipListeners = new Set<(playing: boolean) => void>();

/** Notified when a clip starts/stops (the music lowers its volume meanwhile). */
export function subscribeClip(listener: (playing: boolean) => void) {
  clipListeners.add(listener);
  return () => {
    clipListeners.delete(listener);
  };
}
const notifyClip = (playing: boolean) => clipListeners.forEach((l) => l(playing));

/** Fetch + decode a clip once; later calls reuse it. Resolves null on failure. */
export function loadClip(url: string): Promise<AudioBuffer | null> {
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  let pending = clipCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status}`))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        clipCache.delete(url); // allow a retry later
        return null;
      });
    clipCache.set(url, pending);
  }
  return pending;
}

export function stopClip() {
  const wasPlaying = currentClip !== null;
  try {
    currentClip?.stop();
  } catch {
    // already stopped
  }
  currentClip = null;
  if (wasPlaying) notifyClip(false);
}

/**
 * Play a clip, cutting off the previous one. `stillWanted` is checked once the
 * clip is ready so a late load never speaks over a newer request.
 * `onEnded` is called once when the clip finishes on its own (not when it is cut off);
 * a safety timer fires it too if the audio context stalls (call, tab throttling).
 * Resolves false if the clip couldn't be played (caller can fall back).
 */
export async function playClip(
  url: string,
  stillWanted: () => boolean = () => true,
  onEnded?: () => void,
): Promise<boolean> {
  if (muted) return true;
  const c = getCtx();
  if (!c) return false;
  const buffer = await loadClip(url);
  if (!buffer) return false;
  if (!stillWanted() || muted) return true;
  stopClip();
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(c.destination);
  let safety = 0;
  const finish = () => {
    window.clearTimeout(safety);
    if (currentClip === source) {
      currentClip = null;
      notifyClip(false);
      onEnded?.();
    }
  };
  source.onended = finish;
  safety = window.setTimeout(finish, (buffer.duration + 1.5) * 1000);
  source.start();
  currentClip = source;
  notifyClip(true);
  return true;
}

/** Tone whose pitch slides from `from` to `to` Hz — bubble-like when short. */
function playSweep(from: number, to: number, duration: number, startTime = 0, volume = 0.18) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);

  const t0 = c.currentTime + startTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.start(t0);
  osc.stop(t0 + duration);
}

export function playPop() {
  // A germ bursting like a soap bubble
  playSweep(600, 900, 0.09);
}

export function playTick() {
  // Soft woodblock-like tick for the 3-2-1 countdown
  playSweep(1100, 900, 0.06, 0, 0.12);
}

export function playFanfare() {
  // A cheerful ascending fanfare
  const notes = [
    { freq: 523.25, time: 0, dur: 0.15 },    // C5
    { freq: 659.25, time: 0.15, dur: 0.15 },  // E5
    { freq: 783.99, time: 0.3, dur: 0.15 },   // G5
    { freq: 1046.5, time: 0.45, dur: 0.4 },   // C6 (long)
  ];

  notes.forEach(n => playTone(n.freq, n.dur, 'triangle', n.time));
}

export function playStarSound() {
  // A twinkling star sound
  playTone(1200, 0.1, 'sine', 0);
  playTone(1600, 0.1, 'sine', 0.08);
  playTone(2000, 0.15, 'sine', 0.15);
}

export function playZoneComplete() {
  // Xylophone-like C-E-G chime for zone transition
  playTone(1046.5, 0.18, 'triangle', 0);    // C6
  playTone(1318.5, 0.18, 'triangle', 0.09); // E6
  playTone(1568, 0.3, 'triangle', 0.18);    // G6
}

export function playStartSound() {
  // Rising soap-bubble pops
  playSweep(400, 600, 0.1, 0);
  playSweep(500, 750, 0.1, 0.1);
  playSweep(600, 900, 0.1, 0.2);
  playSweep(750, 1150, 0.16, 0.3);
}
