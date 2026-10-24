import { useState } from "react";
import HomeScreen from "@/components/HomeScreen";
import BrushingScreen from "@/components/BrushingScreen";
import CelebrationScreen from "@/components/CelebrationScreen";
import StickerAlbum from "@/components/StickerAlbum";
import ProfilePicker from "@/components/ProfilePicker";
import ParentsScreen from "@/components/ParentsScreen";
import SyncScreen from "@/components/SyncScreen";
import ToothpasteTipScreen from "@/components/ToothpasteTipScreen";
import { listProfiles, recordSessions, setActiveProfiles, type ProfileSessionResult } from "@/lib/progress";

type AppState = "who" | "home" | "brushing" | "celebration" | "album" | "parents" | "sync" | "tip";

// With several children, the app opens on "Qui se brosse les dents ?"; with one, straight on home.
const startScreen = (): AppState => (listProfiles().length >= 2 ? "who" : "home");

const Index = () => {
  const [state, setState] = useState<AppState>(startScreen);
  const [results, setResults] = useState<ProfileSessionResult[]>([]);

  const handleComplete = () => {
    setResults(recordSessions()); // one slot + one sticker for each child who brushed
    setState("celebration");
  };

  return (
    <>
      {state === "who" && (
        <ProfilePicker
          profiles={listProfiles()}
          onPick={(ids) => {
            setActiveProfiles(ids);
            setState("home");
          }}
          onParents={() => setState("parents")}
        />
      )}
      {state === "home" && (
        <HomeScreen
          onStart={() => setState("brushing")}
          onAlbum={() => setState("album")}
          onTip={() => setState("tip")}
          onSwitch={() => setState("who")}
          onParents={() => setState("parents")}
        />
      )}
      {state === "brushing" && <BrushingScreen onComplete={handleComplete} onCancel={() => setState("home")} />}
      {state === "celebration" && (
        <CelebrationScreen results={results} onDone={() => setState("home")} onAlbum={() => setState("album")} />
      )}
      {state === "album" && <StickerAlbum onBack={() => setState("home")} />}
      {state === "parents" && <ParentsScreen onBack={() => setState(startScreen())} onSync={() => setState("sync")} />}
      {state === "tip" && <ToothpasteTipScreen onBack={() => setState("home")} />}
      {state === "sync" && <SyncScreen onBack={() => setState("parents")} />}
    </>
  );
};

export default Index;
