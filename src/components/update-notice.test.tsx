import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";

vi.mock("@/lib/voice", () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), preloadVoice: vi.fn() }));

const RELEASES = "https://github.com/EtiSZC/quenottes/releases/latest";

/** Fresh copies of the update store and of the screens that read it. */
async function load(native: boolean) {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native } }));
  const updates = await import("@/lib/updates");
  const { default: ParentsScreen } = await import("./ParentsScreen");
  const { default: HomeScreen } = await import("./HomeScreen");
  return { updates, ParentsScreen, HomeScreen };
}
const parents = (P: Awaited<ReturnType<typeof load>>["ParentsScreen"]) => render(<P onBack={() => {}} onSync={() => {}} />);

describe("update notice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("the bottom of the Parents page shows only the version", async () => {
    const { ParentsScreen } = await load(false);
    parents(ParentsScreen);
    expect(screen.getByTestId("app-version")).toHaveTextContent(/^v1\.2\.3$/);
    expect(screen.queryByRole("region", { name: "Mise à jour" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument(); // the switch is for the Android app only
  });

  it("Android: a newer version shows a card with a link to the release, and a dot on Home", async () => {
    const { updates, ParentsScreen, HomeScreen } = await load(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "1.3.0", url: RELEASES }) }));
    await act(async () => {
      parents(ParentsScreen);
    });
    const card = await screen.findByRole("region", { name: "Mise à jour" });
    expect(card).toHaveTextContent("Version 1.3 disponible");
    expect(screen.getByRole("link", { name: "Voir la nouveauté" })).toHaveAttribute("href", RELEASES);
    expect(updates.getUpdateState().apk?.version).toBe("1.3.0");
    expect(screen.getByRole("switch", { name: "Mises à jour" })).toHaveAttribute("aria-checked", "true");
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.getByTestId("update-dot")).toBeInTheDocument();
  });

  it("Android: the switch turns the check off, and no request is made when it is off", async () => {
    const { ParentsScreen } = await load(true);
    localStorage.setItem("brosse-brille:updates", "0");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      parents(ParentsScreen);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Mises à jour" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("region", { name: "Mise à jour" })).not.toBeInTheDocument();
  });

  it("Home has no dot when nothing is known", async () => {
    const { HomeScreen } = await load(false);
    render(<HomeScreen onStart={() => {}} onAlbum={() => {}} onTip={() => {}} onSwitch={() => {}} onParents={() => {}} />);
    expect(screen.queryByTestId("update-dot")).not.toBeInTheDocument();
  });
});
