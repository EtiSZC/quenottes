// Pre-records Brillou's sentences into public/voice/ and writes
// src/data/voice-manifest.json (sentence → file). Only new or changed sentences
// are generated; clips no longer used are deleted.
// Usage: node scripts/generate-voice.mjs   (needs the API key in .env.local)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { VOICE_LINES } from "../src/data/voiceLines.ts";

const VOICE = {
  name: "Lily",
  id: "pFZP5JQG7iQjIQuC4Bku",
  model: "eleven_multilingual_v2",
  settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
};
const OUT_DIR = "public/voice";
const MANIFEST = "src/data/voice-manifest.json";

const key = readFileSync(".env.local", "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error("ELEVENLABS_API_KEY missing from .env.local");

mkdirSync(OUT_DIR, { recursive: true });
const fingerprint = (text) =>
  createHash("sha1").update(JSON.stringify([text, VOICE.id, VOICE.model, VOICE.settings])).digest("hex").slice(0, 12);

const manifest = {};
let generated = 0;
let chars = 0;
for (const text of VOICE_LINES) {
  const file = `${fingerprint(text)}.mp3`;
  manifest[text] = file;
  if (existsSync(`${OUT_DIR}/${file}`)) continue;

  const spoken = text.replace(/ /g, " ");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: spoken, model_id: VOICE.model, voice_settings: VOICE.settings }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} for "${spoken}": ${await res.text()}`);
  writeFileSync(`${OUT_DIR}/${file}`, Buffer.from(await res.arrayBuffer()));
  generated++;
  chars += spoken.length;
  console.log(`✔ ${file}  ${spoken}`);
}

const used = new Set(Object.values(manifest));
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith(".mp3") && !used.has(f)) {
    unlinkSync(`${OUT_DIR}/${f}`);
    console.log(`✖ removed unused ${f}`);
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${VOICE_LINES.length} lines (${VOICE.name}), ${generated} generated, ${chars} characters used.`);
