import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CelebrationScreen from "./CelebrationScreen";
import HomeScreen from "./HomeScreen";
import StickerAlbum from "./StickerAlbum";
import { AUTUMN_STICKERS, HALLOWEEN_STICKERS, STICKERS, recordSession } from "@/lib/progress";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const KID = { id: "default", name: "", avatar: "🦊" };

describe("retention screens", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("celebration: shows the new sticker and says 'À ce soir' in the morning", () => {
    render(
      <CelebrationScreen results={[{ slot: "morning", newSticker: STICKERS[0], streak: 1, profile: KID }]} onDone={() => {}} onAlbum={() => {}} />,
    );
    expect(screen.getByText("Nouvel autocollant !")).toBeInTheDocument();
    expect(screen.getByText(STICKERS[0].name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /À ce soir/ })).toBeInTheDocument();
  });

  it("celebration: says 'À demain' in the evening, with a kind note if the slot was already filled", () => {
    render(<CelebrationScreen results={[{ slot: "evening", newSticker: null, streak: 2, profile: KID }]} onDone={() => {}} onAlbum={() => {}} />);
    expect(screen.getByRole("button", { name: /À demain/ })).toBeInTheDocument();
    expect(screen.getByText(/déjà ton autocollant de ce soir/)).toBeInTheDocument();
    expect(screen.queryByText("Nouvel autocollant !")).not.toBeInTheDocument();
  });

  it("home: shows the week calendar and the album with its sticker count", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 15, 9) }); // no season running: 20 stickers to win
    recordSession(new Date());
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.getByRole("img", { name: /Cette semaine : 1 brossage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mon album : 1 autocollants sur 20/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("album: names earned stickers and counts them", () => {
    const { newSticker } = recordSession(new Date(2026, 9, 7, 8)); // random draw
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 9, 7)} />);
    expect(screen.getByText(newSticker!.name)).toBeInTheDocument();
    expect(screen.getByLabelText("1 sur 20")).toBeInTheDocument();
  });

  it("album: in season the Halloween grid is open on top, with its own counter", () => {
    recordSession(new Date(2026, 9, 20, 8), undefined, () => 0); // in season → Halloween sticker
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 9, 20)} />);
    const sections = screen.getAllByRole("region");
    expect(sections[0]).toHaveAccessibleName("Halloween 2026");
    expect(screen.getByText(HALLOWEEN_STICKERS[0].name)).toBeInTheDocument();
    expect(screen.getByText(`1/${HALLOWEEN_STICKERS.length}`)).toBeInTheDocument();
    expect(screen.getByText(/Seulement pendant Halloween/)).toBeInTheDocument();
    expect(screen.getByLabelText("1 autocollants sur 35")).toBeInTheDocument();
  });

  it("album: after the season Halloween is folded, says a new grid comes back, and unfolds on a tap", () => {
    recordSession(new Date(2026, 9, 20, 8), undefined, () => 0);
    for (let i = 0; i < STICKERS.length; i++) recordSession(new Date(2026, 8, 1 + Math.floor(i / 2), i % 2 ? 20 : 8));
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 11, 1)} />);
    const bar = screen.getByRole("button", { name: /Halloween 2026/ });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Une nouvelle grille revient en octobre 2027/)).toBeInTheDocument();
    expect(screen.queryByText(HALLOWEEN_STICKERS[0].name)).not.toBeInTheDocument();
    fireEvent.click(bar);
    expect(bar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(HALLOWEEN_STICKERS[0].name)).toBeInTheDocument();
    fireEvent.click(bar);
    expect(screen.queryByText(HALLOWEEN_STICKERS[0].name)).not.toBeInTheDocument();
    // finished classics folded under it, still unfoldable
    expect(screen.getByRole("button", { name: /Mes autocollants/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("album: a child who never won a Halloween sticker doesn't see Halloween after the season", () => {
    recordSession(new Date(2026, 8, 7, 8));
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 11, 1)} />);
    expect(screen.queryByText(/Halloween/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 autocollants sur 20")).toBeInTheDocument();
  });

  it("album: in November the whole autumn grid is shown, every box", () => {
    recordSession(new Date(2026, 10, 4, 8), undefined, () => 0);
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 10, 4)} />);
    expect(screen.getByRole("region", { name: "Automne en forêt 2026" })).toBeInTheDocument();
    expect(screen.getByText(`1/${AUTUMN_STICKERS.length}`)).toBeInTheDocument();
    expect(screen.getByText(/Jusqu'au 30 novembre/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Autocollant à gagner")).toHaveLength(AUTUMN_STICKERS.length - 1);
  });

  it("celebration: a Halloween sticker is labelled as such", () => {
    render(
      <CelebrationScreen results={[{ slot: "evening", newSticker: HALLOWEEN_STICKERS[1], season: "halloween", streak: 1, profile: KID }]} onDone={() => {}} onAlbum={() => {}} />,
    );
    expect(screen.getByText(HALLOWEEN_STICKERS[1].name)).toBeInTheDocument();
    expect(screen.getByText(/🎃 Halloween/)).toBeInTheDocument();
  });

  it("celebration: an autumn sticker is labelled as such", () => {
    render(
      <CelebrationScreen results={[{ slot: "evening", newSticker: AUTUMN_STICKERS[0], season: "autumn", streak: 1, profile: KID }]} onDone={() => {}} onAlbum={() => {}} />,
    );
    expect(screen.getByText(/🍂 Automne en forêt/)).toBeInTheDocument();
  });
});
