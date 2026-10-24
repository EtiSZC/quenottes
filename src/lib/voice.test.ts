import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { speak, stopSpeaking } from "./voice";
import { setMuted } from "./sounds";

vi.mock("@capacitor-community/text-to-speech", () => ({
  QueueStrategy: { Flush: 0, Add: 1 },
  TextToSpeech: { speak: vi.fn(() => Promise.resolve()), stop: vi.fn(() => Promise.resolve()) },
}));

describe("voice", () => {
  beforeEach(() => {
    setMuted(false);
    vi.mocked(TextToSpeech.speak).mockClear();
    vi.mocked(TextToSpeech.stop).mockClear();
  });

  it("speaks French and turns non-breaking spaces into normal ones", () => {
    speak("Bravo\u00A0!");
    expect(TextToSpeech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Bravo !", lang: "fr-FR" }));
  });

  it("stays silent when muted and cuts off speech when muting", () => {
    setMuted(true);
    expect(TextToSpeech.stop).toHaveBeenCalled();
    speak("Coucou");
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
  });

  describe("when a sentence is over", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("resolves true after its estimated time when the device voice speaks it", async () => {
      const done = vi.fn();
      speak("Une phrase sans clip").then(done);
      await vi.advanceTimersByTimeAsync(1000);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      expect(done).toHaveBeenCalledWith(true);
    });

    it("resolves true after its estimated time when muted, so a visual sequence keeps going", async () => {
      setMuted(true);
      const done = vi.fn();
      speak("Coucou").then(done);
      await vi.advanceTimersByTimeAsync(1300);
      expect(done).toHaveBeenCalledWith(true);
    });

    it("resolves false when a newer sentence cuts it off, or when speech is stopped", async () => {
      const first = vi.fn();
      const second = vi.fn();
      speak("Première phrase").then(first);
      speak("Seconde phrase").then(second);
      await vi.advanceTimersByTimeAsync(0);
      expect(first).toHaveBeenCalledWith(false);
      stopSpeaking();
      await vi.advanceTimersByTimeAsync(0);
      expect(second).toHaveBeenCalledWith(false);
    });

    it("muting in the middle of a sentence lets the sequence move on", async () => {
      const done = vi.fn();
      speak("Une phrase en cours").then(done);
      setMuted(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(done).toHaveBeenCalledWith(true);
    });
  });
});
