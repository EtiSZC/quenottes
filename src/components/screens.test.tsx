import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CelebrationScreen from "./CelebrationScreen";
import HomeScreen from "./HomeScreen";
import StickerAlbum from "./StickerAlbum";
import { HALLOWEEN_STICKERS, STICKERS, recordSession } from "@/lib/progress";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const KID = { id: "default", name: "", avatar: "🦊" };

describe("retention screens", () => {
  beforeEach(() => localStorage.clear());

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
    recordSession(new Date());
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.getByRole("img", { name: /Cette semaine : 1 brossage/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mon album : 1 autocollants sur 35/ })).toBeInTheDocument();
  });

  it("album: names earned stickers and counts them", () => {
    const { newSticker } = recordSession(new Date(2026, 9, 7, 8)); // random draw
    render(<StickerAlbum onBack={() => {}} />);
    expect(screen.getByText(newSticker!.name)).toBeInTheDocument();
    expect(screen.getByText("1/20")).toBeInTheDocument();
  });

  it("album: a Halloween page with its own counter; out of season it says they come back in October", () => {
    recordSession(new Date(2026, 9, 20, 8), undefined, () => 0); // in season → Halloween sticker
    const { unmount } = render(<StickerAlbum onBack={() => {}} now={new Date(2026, 9, 20)} />);
    expect(screen.getByRole("region", { name: "Halloween" })).toBeInTheDocument();
    expect(screen.getByText(HALLOWEEN_STICKERS[0].name)).toBeInTheDocument();
    expect(screen.getByText(`1/${HALLOWEEN_STICKERS.length}`)).toBeInTheDocument();
    expect(screen.getByText(/Seulement pendant Halloween/)).toBeInTheDocument();
    unmount();
    render(<StickerAlbum onBack={() => {}} now={new Date(2026, 11, 1)} />);
    expect(screen.getByText(/Ils reviennent en octobre/)).toBeInTheDocument();
    expect(screen.getByText(HALLOWEEN_STICKERS[0].name)).toBeInTheDocument(); // still in the album
  });

  it("celebration: a Halloween sticker is labelled as such", () => {
    render(
      <CelebrationScreen results={[{ slot: "evening", newSticker: HALLOWEEN_STICKERS[1], streak: 1, profile: KID }]} onDone={() => {}} onAlbum={() => {}} />,
    );
    expect(screen.getByText(HALLOWEEN_STICKERS[1].name)).toBeInTheDocument();
    expect(screen.getByText(/🎃 Halloween/)).toBeInTheDocument();
  });
});
