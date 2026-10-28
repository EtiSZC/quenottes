// Music mode: a cheerful xylophone loop synthesized live (no audio files, no
// licence, works offline), synced to the brushing steps:
// - upper teeth: theme in C major; lower teeth: same theme in F major + shaker
// - a short xylophone flourish at each step change, a finale at 3:00
// The score is a pure function (time → notes); a small scheduler plays it on the
// shared AudioContext and follows the session clock, so pausing/resuming stays in sync.
import { TOTAL_DURATION, ZONE_STARTS } from "@/data/brushingZones";
import { getAudioContext, isMuted, subscribeClip, subscribeMuted } from "./sounds";

const BPM = 104;
const EIGHTH = 60 / BPM / 2;
export const BAR = EIGHTH * 8;

export interface ScoreOptions {
  /** Length of the piece (s); the finale fills its last bar. */
  total: number;
  /** Times (s) of each step start: a flourish plays at every one but the first. */
  stepStarts: number[];
  /** From this time the theme moves up to F major (lower teeth). */
  secondHalfFrom: number;
}

export const APP_SCORE: ScoreOptions = {
  total: TOTAL_DURATION,
  stepStarts: ZONE_STARTS,
  secondHalfFrom: ZONE_STARTS[4], // zone 5 = "Devant en bas", first lower-teeth step
};

export type Instrument = "mallet" | "bass" | "strum" | "clap" | "shaker" | "kick";

export interface NoteEvent {
  time: number;
  instrument: Instrument;
  /** MIDI notes (one for most instruments, a triad for strums). */
  notes: number[];
  velocity: number;
}

// I – V – vi – IV – I – V – IV – V (roots relative to the key, chord = major except vi).
const CHORD_ROOTS = [0, 7, 9, 5, 0, 7, 5, 7];
// Melody in C major: per bar, [eighth position, MIDI note].
const MELODY: [number, number][][] = [
  [[0, 76], [2, 79], [4, 76], [6, 72]],
  [[0, 74], [2, 79], [4, 74], [6, 71]],
  [[0, 72], [2, 76], [3, 79], [4, 81], [6, 79]],
  [[0, 77], [2, 76], [4, 74], [6, 72]],
  [[0, 76], [1, 77], [2, 79], [4, 84], [6, 79]],
  [[0, 79], [2, 77], [4, 74], [6, 71]],
  [[0, 72], [2, 74], [4, 77], [5, 76], [6, 74]],
  [[0, 74], [2, 71], [4, 74], [6, 79]],
];

const triad = (root: number) => {
  const minor = (((root - 60) % 12) + 12) % 12 === 9; // vi chord of the key
  return [root, root + (minor ? 3 : 4), root + 7];
};

/** Every note that starts in [from, to). Deterministic: same input → same music. */
export function scoreEvents(from: number, to: number, o: ScoreOptions): NoteEvent[] {
  const events: NoteEvent[] = [];
  const finaleStart = o.total - BAR;
  const keyAt = (t: number) => (t >= o.secondHalfFrom ? 5 : 0); // C major → F major

  for (let k = Math.max(0, Math.ceil(from / EIGHTH - 1e-9)); k * EIGHTH < to; k++) {
    const t = k * EIGHTH;
    if (t >= finaleStart) break;
    const bar = Math.floor(k / 8) % 8;
    const pos = k % 8;
    const key = keyAt(t);
    const chordRoot = 60 + CHORD_ROOTS[bar] + key;

    if (pos === 0) events.push({ time: t, instrument: "kick", notes: [], velocity: 0.7 });
    if (pos === 0 || pos === 4) events.push({ time: t, instrument: "bass", notes: [chordRoot - 24], velocity: 0.9 });
    if (pos === 2 || pos === 6) {
      events.push({ time: t, instrument: "clap", notes: [], velocity: 0.6 });
      events.push({ time: t, instrument: "strum", notes: triad(chordRoot), velocity: 0.8 });
    }
    if (key && pos % 2 === 1) events.push({ time: t, instrument: "shaker", notes: [], velocity: 0.5 });
    for (const [p, midi] of MELODY[bar]) {
      if (p === pos) events.push({ time: t, instrument: "mallet", notes: [midi + key], velocity: 0.85 });
    }
  }

  // Flourish at each step change (not at 0:00).
  for (const s of o.stepStarts) {
    if (s > 0 && s >= from && s < to && s < finaleStart) {
      [84, 88, 91, 96].forEach((m, i) =>
        events.push({ time: s + i * 0.06, instrument: "mallet", notes: [m + keyAt(s)], velocity: 0.7 }),
      );
    }
  }

  // Finale: rising arpeggio, then a bright chord.
  if (finaleStart >= from && finaleStart < to) {
    const key = keyAt(finaleStart);
    events.push({ time: finaleStart, instrument: "kick", notes: [], velocity: 0.8 });
    events.push({ time: finaleStart, instrument: "bass", notes: [36 + key], velocity: 1 });
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) =>
      events.push({ time: finaleStart + i * 0.09, instrument: "mallet", notes: [m + key], velocity: 0.8 }),
    );
    const end = finaleStart + 0.75;
    events.push({ time: end, instrument: "strum", notes: triad(72 + key), velocity: 1 });
    events.push({ time: end, instrument: "mallet", notes: [96 + key], velocity: 0.9 });
    events.push({ time: end, instrument: "clap", notes: [], velocity: 0.8 });
  }

  return events.sort((a, b) => a.time - b.time);
}

// ---------------------------------------------------------------------------
// Synthesis (works on live and offline audio contexts)
// ---------------------------------------------------------------------------

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

function envelope(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(out);
  return g;
}

function tone(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, type: OscillatorType, peak: number, decay: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, t);
  osc.connect(envelope(ctx, out, t, peak, decay));
  osc.start(t);
  osc.stop(t + decay + 0.05);
  return osc;
}

function noiseHit(ctx: BaseAudioContext, out: AudioNode, t: number, filter: BiquadFilterType, hz: number, peak: number, decay: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = hz;
  src.connect(f);
  f.connect(envelope(ctx, out, t, peak, decay));
  src.start(t);
  src.stop(t + decay + 0.05);
}

export function playEvent(ctx: BaseAudioContext, out: AudioNode, t: number, e: NoteEvent) {
  const v = e.velocity;
  switch (e.instrument) {
    case "mallet": // xylophone: body + short metallic overtone
      tone(ctx, out, t, midiToHz(e.notes[0]), "sine", 0.32 * v, 0.55);
      tone(ctx, out, t, midiToHz(e.notes[0]) * 4, "sine", 0.06 * v, 0.12);
      break;
    case "bass":
      tone(ctx, out, t, midiToHz(e.notes[0]), "triangle", 0.3 * v, 0.35);
      break;
    case "strum": // ukulele-like: notes a few ms apart
      e.notes.forEach((m, i) => tone(ctx, out, t + i * 0.012, midiToHz(m), "triangle", 0.07 * v, 0.28));
      break;
    case "clap":
      noiseHit(ctx, out, t, "bandpass", 1500, 0.22 * v, 0.12);
      break;
    case "shaker":
      noiseHit(ctx, out, t, "highpass", 6000, 0.06 * v, 0.05);
      break;
    case "kick": {
      const osc = tone(ctx, out, t, 120, "sine", 0.4 * v, 0.18);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Setting (on by default, remembered)
// ---------------------------------------------------------------------------

const MUSIC_KEY = "brosse-brille:music";
const musicListeners = new Set<(on: boolean) => void>();
let musicOn = (() => {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "0";
  } catch {
    return true;
  }
})();

export const isMusicOn = () => musicOn;

export function setMusicOn(on: boolean) {
  musicOn = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? "1" : "0");
  } catch {
    // Storage unavailable: keep the in-memory value.
  }
  musicListeners.forEach((l) => l(on));
}

export function subscribeMusic(listener: (on: boolean) => void) {
  musicListeners.add(listener);
  return () => {
    musicListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Live player: schedules notes slightly ahead, follows the session clock
// ---------------------------------------------------------------------------

// Measured: Lily's clips ≈ -20.7 dBFS (active RMS); the score at gain 0.55 ≈ -26 dBFS.
// Music stays ≥ 12 dB under the voice, and ≥ 20 dB under it while Quenottes speaks.
export const MUSIC_LEVEL = 0.24; // ≈ -33 dBFS → ~12.5 dB below the voice
export const MUSIC_DUCKED = 0.09; // ≈ -41.6 dBFS → ~21 dB below the voice while it speaks
const LEVEL = MUSIC_LEVEL;
const DUCKED = MUSIC_DUCKED;
const LOOKAHEAD = 0.25;

let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let ducked = false;

/** Start (or resume) the music at `fromSec` seconds into the session. */
export function startMusic(fromSec: number, options: ScoreOptions = APP_SCORE) {
  stopMusic();
  if (!musicOn || isMuted() || fromSec >= options.total) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.setTargetAtTime(ducked ? DUCKED : LEVEL, ctx.currentTime, 0.08);
  out.connect(ctx.destination);
  master = out;

  const origin = ctx.currentTime - fromSec; // context time of 0:00
  let scheduledUntil = fromSec;
  const tick = () => {
    const until = ctx.currentTime - origin + LOOKAHEAD;
    if (until <= scheduledUntil) return;
    for (const e of scoreEvents(scheduledUntil, until, options)) playEvent(ctx, out, origin + e.time, e);
    scheduledUntil = until;
  };
  tick();
  timer = setInterval(tick, 60);
}

export function stopMusic() {
  clearInterval(timer);
  timer = undefined;
  if (!master) return;
  const m = master;
  master = null;
  const now = m.context.currentTime;
  m.gain.cancelScheduledValues(now);
  m.gain.setTargetAtTime(0.0001, now, 0.04);
  setTimeout(() => m.disconnect(), 300);
}

// Lower the music while Quenottes speaks; stop it when muted.
subscribeClip((playing) => {
  ducked = playing;
  if (master) master.gain.setTargetAtTime(playing ? DUCKED : LEVEL, master.context.currentTime, 0.06);
});
subscribeMuted((muted) => {
  if (muted) stopMusic();
});

// ---------------------------------------------------------------------------
// Offline render (samples / previews): the same score and instruments to a WAV
// ---------------------------------------------------------------------------

export async function renderMusic(seconds: number, options: ScoreOptions): Promise<Uint8Array> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const out = ctx.createGain();
  out.gain.value = LEVEL;
  out.connect(ctx.destination);
  for (const e of scoreEvents(0, seconds, options)) playEvent(ctx, out, e.time, e);
  return encodeWav(await ctx.startRendering());
}

function encodeWav(buffer: AudioBuffer): Uint8Array {
  const samples = buffer.getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  bytes.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true); // PCM
  bytes.setUint16(22, 1, true); // mono
  bytes.setUint32(24, buffer.sampleRate, true);
  bytes.setUint32(28, buffer.sampleRate * 2, true);
  bytes.setUint16(32, 2, true);
  bytes.setUint16(34, 16, true);
  text(36, "data");
  bytes.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Uint8Array(bytes.buffer);
}
