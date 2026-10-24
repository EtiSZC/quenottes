import { describe, it, expect, vi, beforeEach } from "vitest";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { speak } from "./voice";
import { playClip } from "./sounds";
import manifest from "@/data/voice-manifest.json";
import { FINISH_LINE, VOICE_LINES } from "@/data/voiceLines";

vi.mock("@capacitor-community/text-to-speech", () => ({
  QueueStrategy: { Flush: 0, Add: 1 },
  TextToSpeech: { speak: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) },
}));
vi.mock("./sounds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sounds")>()),
  playClip: vi.fn(() => Promise.resolve(true)),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("pre-recorded voice", () => {
  beforeEach(() => {
    vi.mocked(playClip).mockClear();
    vi.mocked(TextToSpeech.speak).mockClear();
  });

  it("has a recorded clip for every sentence Brillou says", () => {
    for (const line of VOICE_LINES) expect(manifest).toHaveProperty([line]);
  });

  it("plays Lily's clip instead of the device voice", async () => {
    speak(FINISH_LINE);
    await flush();
    expect(playClip).toHaveBeenCalledWith(expect.stringMatching(/voice\/[0-9a-f]{12}\.mp3$/), expect.any(Function), expect.any(Function));
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
  });

  it("falls back to the device voice if the clip can't be played", async () => {
    vi.mocked(playClip).mockResolvedValueOnce(false);
    speak(FINISH_LINE);
    await flush();
    expect(TextToSpeech.speak).toHaveBeenCalledWith(expect.objectContaining({ lang: "fr-FR" }));
  });
});
