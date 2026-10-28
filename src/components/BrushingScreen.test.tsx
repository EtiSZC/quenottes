import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import BrushingScreen from "./BrushingScreen";
import { speak, stopSpeaking } from "@/lib/voice";
import { isMusicOn, startMusic, stopMusic } from "@/lib/music";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));
vi.mock("@/lib/music", () => ({
  isMusicOn: vi.fn(() => true),
  startMusic: vi.fn(),
  stopMusic: vi.fn(),
  subscribeMusic: vi.fn(() => () => {}),
}));

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
};

describe("BrushingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(speak).mockClear();
    vi.mocked(stopSpeaking).mockClear();
    vi.mocked(startMusic).mockClear();
    vi.mocked(stopMusic).mockClear();
    vi.mocked(isMusicOn).mockReturnValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("counts down from 3:00", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("3:00")).toBeInTheDocument();
    advance(5000);
    expect(screen.getByText("2:55")).toBeInTheDocument();
  });

  it("freezes time while paused and resumes where it left off", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    advance(5000);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    advance(10000);
    expect(screen.getByText("2:55")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    advance(5000);
    expect(screen.getByText("2:50")).toBeInTheDocument();
  });

  it("asks before quitting: ✕ pauses, only 'Arrêter' cancels", () => {
    const onCancel = vi.fn();
    render(<BrushingScreen onComplete={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrêter" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The dialog's own "Arrêter" button is the second one now on screen.
    const stopButtons = screen.getAllByRole("button", { name: "Arrêter" });
    fireEvent.click(stopButtons[stopButtons.length - 1]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("auto-pauses when the app goes to the background", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    advance(3000);
    setVisibility("hidden");
    advance(20000);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("2:57")).toBeInTheDocument();
  });

  it("shows the 'everything shines' moment at 3:00, then completes exactly once", () => {
    const onComplete = vi.fn();
    render(<BrushingScreen onComplete={onComplete} onCancel={() => {}} />);
    advance(179000);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1000);
    // (Checked via the mouth's label: the speech bubble swaps with an exit
    // animation that framer-motion doesn't complete under fake timers.)
    expect(screen.getByRole("img", { name: "Toutes les dents brillent" })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    advance(2000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    advance(10000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("has Quenottes say the instruction, stop on pause and repeat it on resume", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    advance(500);
    expect(speak).toHaveBeenCalledWith("Brosse le devant des dents du haut\u00A0!");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(stopSpeaking).toHaveBeenCalled();

    vi.mocked(speak).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    advance(500);
    expect(speak).toHaveBeenCalledWith("Brosse le devant des dents du haut\u00A0!");
  });

  it("counts down 3-2-1 before the next step", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    advance(18000);
    expect(screen.queryByTestId("countdown")).not.toBeInTheDocument();
    advance(1250); // 19.25 s: 2.75 s left in step 1 (22 s)
    expect(screen.getByTestId("countdown")).toHaveTextContent("3");
  });

  it("shows the side marker only for back-teeth steps, on the right side", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    advance(5000);
    expect(screen.queryByTestId(/side-marker/)).not.toBeInTheDocument();
    advance(41000); // 46 s: upper-left back teeth
    expect(screen.getByTestId("side-marker-left")).toBeInTheDocument();
  });

  it("plays the music with the session, stops on pause and resumes in sync", () => {
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    expect(startMusic).toHaveBeenCalledWith(0);
    advance(5000);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(stopMusic).toHaveBeenCalled();
    vi.mocked(startMusic).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(startMusic).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startMusic).mock.calls[0][0]).toBeCloseTo(5, 0);
  });

  it("doesn't start the music when 🎵 is off", () => {
    vi.mocked(isMusicOn).mockReturnValue(false);
    render(<BrushingScreen onComplete={() => {}} onCancel={() => {}} />);
    expect(startMusic).not.toHaveBeenCalled();
  });
});
