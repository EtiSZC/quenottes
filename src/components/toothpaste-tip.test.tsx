import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ToothpasteTipScreen from "./ToothpasteTipScreen";
import ToothpasteQuantity from "./illustrations/ToothpasteQuantity";
import HomeScreen from "./HomeScreen";
import ParentsScreen from "./ParentsScreen";
import { speak, stopSpeaking } from "@/lib/voice";
import { setMuted } from "@/lib/sounds";
import { TIP_OPEN_LINE, TIP_PEA_LINE, TIP_SPIT_LINE, TIP_TOO_MUCH_LINE } from "@/data/toothpasteTip";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));

const brush = () => screen.getByRole("button", { name: "Mettre un petit pois de dentifrice sur la brosse" });

describe("toothpaste tip screen", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(speak).mockClear();
    vi.mocked(stopSpeaking).mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the title and says the headline once when it opens", () => {
    render(<ToothpasteTipScreen onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Le petit pois" })).toBeInTheDocument();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(TIP_OPEN_LINE);
  });

  it("tapping the brush puts a pea, says the pea line, then the spit line once; tapping again empties it", () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    fireEvent.click(brush());
    expect(brush()).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("svg[data-state='pea']")).not.toBeNull();
    expect(speak).toHaveBeenLastCalledWith(TIP_PEA_LINE);
    expect(screen.getByRole("status")).toHaveTextContent("Un petit pois sur la brosse");

    act(() => vi.advanceTimersByTime(3000));
    expect(speak).toHaveBeenLastCalledWith(TIP_SPIT_LINE);

    fireEvent.click(brush()); // pop
    expect(container.querySelector("svg[data-state='empty']")).not.toBeNull();
    fireEvent.click(brush()); // pea again: the spit line is not repeated
    act(() => vi.advanceTimersByTime(3000));
    expect(vi.mocked(speak).mock.calls.filter(([t]) => t === TIP_SPIT_LINE)).toHaveLength(1);
  });

  it("« Trop ? » shows the blob, says so, then the pea comes back", () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Trop/ }));
    expect(container.querySelector("svg[data-state='blob']")).not.toBeNull();
    expect(speak).toHaveBeenLastCalledWith(TIP_TOO_MUCH_LINE);
    expect(screen.getByRole("status")).toHaveTextContent("Un petit pois suffit");
    act(() => vi.advanceTimersByTime(2600));
    expect(container.querySelector("svg[data-state='pea']")).not.toBeNull();
  });

  it("tapping Brillou repeats what the bubble says", () => {
    render(<ToothpasteTipScreen onBack={() => {}} />);
    vi.mocked(speak).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Réécouter Brillou" }));
    expect(speak).toHaveBeenCalledWith(TIP_OPEN_LINE);
  });

  it("back stops the voice and leaves; unmounting also stops it", () => {
    const onBack = vi.fn();
    const { unmount } = render(<ToothpasteTipScreen onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(stopSpeaking).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    vi.mocked(stopSpeaking).mockClear();
    unmount();
    expect(stopSpeaking).toHaveBeenCalled();
  });

  it("leaving cancels the pending spit line", () => {
    const { unmount } = render(<ToothpasteTipScreen onBack={() => {}} />);
    fireEvent.click(brush());
    unmount();
    vi.mocked(speak).mockClear();
    act(() => vi.advanceTimersByTime(5000));
    expect(speak).not.toHaveBeenCalled();
  });

  it("has no score, timer or negative wording on screen", () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Trop/ }));
    expect(container.textContent).not.toMatch(/score|étoile|minute|triste|raté|perdu|❌|✕/i);
  });

  it("has a mute button and the adult footnote", () => {
    render(<ToothpasteTipScreen onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /son/ })).toBeInTheDocument();
    expect(screen.getByText(/On crache, on ne rince pas/)).toBeInTheDocument();
    setMuted(false);
  });
});

describe("toothpaste illustration", () => {
  it("reduced motion: no sparkles and no pulsing hint ring", () => {
    const { container, rerender } = render(<ToothpasteQuantity state="pea" hint={false} pops={1} reduced />);
    expect(container.querySelector("[data-sparkles]")).toBeNull();
    rerender(<ToothpasteQuantity state="empty" hint reduced pops={0} />);
    expect(container.querySelector("[data-hint-pulse]")).not.toBeNull(); // the ring stays, static
  });

  it("normal motion: a landing pea sparkles", () => {
    const { container } = render(<ToothpasteQuantity state="pea" hint={false} pops={1} reduced={false} />);
    expect(container.querySelector("[data-sparkles]")).not.toBeNull();
  });
});

describe("entry points", () => {
  it("home has a labelled button that opens the tip", () => {
    const onTip = vi.fn();
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={onTip} onSwitch={() => {}} onParents={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Le petit pois de dentifrice" }));
    expect(onTip).toHaveBeenCalledTimes(1);
  });

  it("the parents area carries the « repères » card with its sources", () => {
    localStorage.clear();
    render(<ParentsScreen onBack={() => {}} onSync={() => {}} />);
    const card = screen.getByRole("region", { name: "Dentifrice : les repères" });
    expect(card).toHaveTextContent("Un petit pois à partir de 3 ans");
    expect(card).toHaveTextContent("Haute Autorité de santé");
    expect(card.querySelector("a")).toBeNull(); // no outbound link
  });
});
