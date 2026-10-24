import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ToothpasteTipScreen from "./ToothpasteTipScreen";
import ToothpasteQuantity from "./illustrations/ToothpasteQuantity";
import HomeScreen from "./HomeScreen";
import ParentsScreen from "./ParentsScreen";
import { speak, stopSpeaking } from "@/lib/voice";
import { TIP_OPEN_LINE, TIP_PEA_LINE, TIP_SPIT_LINE, TIP_TOO_MUCH_LINE } from "@/data/toothpasteTip";

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motion.reduced,
}));
vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));

/** A spoken line whose end the test controls. */
const pendingLine = () => {
  let end: (finished: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => (end = resolve));
  return { promise, end };
};
const spoken = () => vi.mocked(speak).mock.calls.map(([text]) => text);
const stage = (c: HTMLElement) => c.querySelector("svg[data-stage]")?.getAttribute("data-stage");
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const troppButton = () => screen.getByRole("button", { name: /Trop/ });

describe("toothpaste tip screen", () => {
  beforeEach(() => {
    localStorage.clear();
    motion.reduced = false;
    vi.mocked(speak).mockReset();
    vi.mocked(speak).mockImplementation(() => Promise.resolve(true)); // every line ends at once
    vi.mocked(stopSpeaking).mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("opens on the headline, with nothing to touch but ←, 🔊 and a disabled « Trop ? »", () => {
    const first = pendingLine();
    vi.mocked(speak).mockImplementationOnce(() => first.promise);
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Le petit pois" })).toBeInTheDocument();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(TIP_OPEN_LINE);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Retour",
      "Couper le son",
      "Trop ?",
    ]);
    expect(troppButton()).toBeDisabled();
    expect(container.querySelector("[data-pea]")).toBeNull();
    expect(screen.getByRole("img", { name: /tube de dentifrice dépose un petit pois/ })).toBeInTheDocument();
    expect(screen.getByAltText("Quenottes la mascotte").closest("button")).toBeNull();
  });

  it("waits for the voice to end before the tube squeezes the pea out", async () => {
    const first = pendingLine();
    vi.mocked(speak).mockImplementationOnce(() => first.promise);
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    expect(stage(container)).toBe("arrive");
    await advance(10_000); // however long the voice lasts, nothing happens without its end
    expect(stage(container)).toBe("arrive");
    expect(container.querySelector("[data-pea]")).toBeNull();

    first.end(true);
    await advance(0);
    await advance(300);
    expect(stage(container)).toBe("squeeze");
    expect(container.querySelector("[data-pea]")).not.toBeNull();
    await advance(800);
    expect(stage(container)).toBe("drop");
  });

  it("then confirms and reminds to spit, one line after the other, and finally allows « Trop ? »", async () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    await advance(0);
    await advance(300 + 800 + 450 + 250); // beat, squeeze, drop, landing
    expect(stage(container)).toBe("leave");
    expect(screen.getByRole("status")).toHaveTextContent("Un petit pois sur la brosse");
    expect(screen.getByText(/Parfait.*Juste un petit pois/, { selector: "p" })).toBeInTheDocument(); // (getByText normalizes the NBSP in the DOM, not in the query)
    expect(spoken()).toEqual([TIP_OPEN_LINE, TIP_PEA_LINE]);
    await advance(300);
    expect(spoken()).toEqual([TIP_OPEN_LINE, TIP_PEA_LINE, TIP_SPIT_LINE]);
    expect(troppButton()).toBeEnabled();
  });

  it("leaving in the middle of a line stops the voice and nothing happens afterwards", async () => {
    const first = pendingLine();
    vi.mocked(speak).mockImplementationOnce(() => first.promise);
    const { unmount } = render(<ToothpasteTipScreen onBack={() => {}} />);
    unmount();
    expect(stopSpeaking).toHaveBeenCalled();
    first.end(true);
    await advance(10_000);
    expect(spoken()).toEqual([TIP_OPEN_LINE]);
  });

  it("← stops the voice and goes back", () => {
    const onBack = vi.fn();
    render(<ToothpasteTipScreen onBack={onBack} />);
    vi.mocked(stopSpeaking).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(stopSpeaking).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("« Trop ? » shows the blob with its line, then the pea is back", async () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    await advance(0);
    await advance(300 + 800 + 450 + 250 + 300);
    fireEvent.click(troppButton());
    expect(container.querySelector("svg[data-blob]")).not.toBeNull();
    expect(spoken().at(-1)).toBe(TIP_TOO_MUCH_LINE);
    expect(screen.getByRole("status")).toHaveTextContent("Un petit pois suffit");
    expect(troppButton()).toBeDisabled();
    await advance(2500);
    expect(container.querySelector("svg[data-blob]")).toBeNull();
    expect(troppButton()).toBeEnabled();
  });

  it("with reduced motion the tube never shows and the pea simply appears", async () => {
    motion.reduced = true;
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    expect(stage(container)).toBe("idle");
    await advance(0);
    await advance(300);
    expect(stage(container)).toBe("drop");
    expect(container.querySelector("[data-tube]")).toBeNull();
    expect(container.querySelector("[data-pea]")).not.toBeNull();
    await advance(250);
    expect(stage(container)).toBe("leave");
    expect(spoken()).toContain(TIP_PEA_LINE);
  });

  it("has no score, timer or negative wording on screen", async () => {
    const { container } = render(<ToothpasteTipScreen onBack={() => {}} />);
    await advance(0);
    await advance(5000);
    fireEvent.click(troppButton());
    expect(container.textContent).not.toMatch(/score|étoile|minute|triste|raté|perdu|❌|✕/i);
    expect(container.textContent).not.toMatch(/Touche la brosse/);
  });
});

describe("toothpaste illustration", () => {
  it("normal motion: the tube is there while it works, the landing sparkles, the pea is oval", () => {
    const { container, rerender } = render(<ToothpasteQuantity stage="squeeze" blob={false} reduced={false} />);
    expect(container.querySelector("[data-tube]")).not.toBeNull();
    expect(container.querySelector("[data-sparkles]")).toBeNull();
    rerender(<ToothpasteQuantity stage="drop" blob={false} reduced={false} />);
    expect(container.querySelector("[data-sparkles]")).not.toBeNull();
    const pea = container.querySelector("[data-pea] ellipse");
    expect(Number(pea?.getAttribute("rx"))).toBeGreaterThan(Number(pea?.getAttribute("ry")));
  });

  it("reduced motion: no tube, no sparkles", () => {
    const { container } = render(<ToothpasteQuantity stage="drop" blob={false} reduced />);
    expect(container.querySelector("[data-tube]")).toBeNull();
    expect(container.querySelector("[data-sparkles]")).toBeNull();
    expect(container.querySelector("[data-pea]")).not.toBeNull();
  });

  it("the blob replaces the pea", () => {
    const { container } = render(<ToothpasteQuantity stage="leave" blob reduced={false} />);
    expect(container.querySelector("[data-blob-shape]")).not.toBeNull();
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
