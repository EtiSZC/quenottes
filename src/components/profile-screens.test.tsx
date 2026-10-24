import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProfilePicker from "./ProfilePicker";
import ParentsScreen from "./ParentsScreen";
import CelebrationScreen from "./CelebrationScreen";
import HomeScreen from "./HomeScreen";
import { STICKERS, addProfile, listProfiles, setActiveProfiles } from "@/lib/progress";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const LEA = { id: "lea", name: "Léa", avatar: "🦊" };
const TOM = { id: "tom", name: "Tom", avatar: "🐼" };

describe("profile screens", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("picker: one tap picks a child; 'Brosser ensemble' picks several", () => {
    const onPick = vi.fn();
    const { rerender } = render(<ProfilePicker profiles={[LEA, TOM]} onPick={onPick} onParents={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Léa/ }));
    expect(onPick).toHaveBeenLastCalledWith(["lea"]);

    rerender(<ProfilePicker key="2" profiles={[LEA, TOM]} onPick={onPick} onParents={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Brosser ensemble/ }));
    fireEvent.click(screen.getByRole("button", { name: /Léa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tom/ }));
    fireEvent.click(screen.getByRole("button", { name: /C'est parti/ }));
    expect(onPick).toHaveBeenLastCalledWith(["lea", "tom"]);
  });

  it("picker and home both show the app name, Quenottes", () => {
    const { unmount } = render(<ProfilePicker profiles={[LEA, TOM]} onPick={() => {}} onParents={() => {}} />);
    expect(screen.getByText("Quenottes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qui se brosse les dents ?" })).toBeInTheDocument();
    unmount();
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.getByRole("heading", { name: "Quenottes" })).toBeInTheDocument();
  });

  it("parent gate: a short tap does nothing, holding 2 seconds opens it", () => {
    vi.useFakeTimers();
    const onParents = vi.fn();
    render(<ProfilePicker profiles={[LEA, TOM]} onPick={() => {}} onParents={onParents} />);
    const gate = screen.getByRole("button", { name: /Espace parents/ });
    fireEvent.pointerDown(gate);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(gate);
    act(() => vi.advanceTimersByTime(3000));
    expect(onParents).not.toHaveBeenCalled();

    fireEvent.pointerDown(gate);
    act(() => vi.advanceTimersByTime(2000));
    expect(onParents).toHaveBeenCalledTimes(1);
  });

  it("parents screen: add a child, name them, and confirm before deleting", () => {
    render(<ParentsScreen onBack={() => {}} onSync={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un enfant/ }));
    const inputs = screen.getAllByLabelText("Prénom ou surnom");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[1], { target: { value: "Tom" } });
    expect(listProfiles()[1].name).toBe("Tom");

    fireEvent.click(screen.getByRole("button", { name: "Supprimer Tom" }));
    expect(listProfiles()).toHaveLength(2); // not yet
    fireEvent.click(screen.getByRole("button", { name: "Oui, supprimer" }));
    expect(listProfiles()).toHaveLength(1);
  });

  it("celebration: brushing together names everyone and shows one sticker per child", () => {
    render(
      <CelebrationScreen
        results={[
          { slot: "evening", newSticker: STICKERS[3], streak: 1, profile: LEA },
          { slot: "evening", newSticker: STICKERS[7], streak: 2, profile: TOM },
        ]}
        onDone={() => {}}
        onAlbum={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "Bravo Léa et Tom\u00A0!" })).toBeInTheDocument();
    expect(screen.getByText(STICKERS[3].name)).toBeInTheDocument();
    expect(screen.getByText(STICKERS[7].name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /À demain/ })).toBeInTheDocument();
  });

  it("home: shows who is brushing once there are two profiles", () => {
    const lea = addProfile("Léa", "🦊")!;
    setActiveProfiles([lea.id]);
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.getByRole("button", { name: /Changer d'enfant \(actuellement Léa\)/ })).toBeInTheDocument();
    expect(screen.getByText(/On brosse ensemble, Léa/)).toBeInTheDocument(); // (getByText normalizes the NBSP in the DOM, not in the query)
  });
});
