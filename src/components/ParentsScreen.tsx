import { useState } from "react";
import BathroomBackground from "@/components/BathroomBackground";
import { Button } from "@/components/ui/button";
import {
  AVATARS,
  MAX_PROFILES,
  addProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  loadProgress,
  updateProfile,
  type ProfileMeta,
} from "@/lib/progress";
import { cn } from "@/lib/utils";
import { suggestSameChild } from "@/lib/sync";
import SameChildCard from "@/components/SameChildCard";
import { PARENT_TIP } from "@/data/toothpasteTip";

interface ParentsScreenProps {
  onBack: () => void;
  /** Opens phone-to-phone sync (QR codes). */
  onSync: () => void;
}

/** Profile management (behind the long-press gate): names, avatars, add, delete. */
const ParentsScreen = ({ onBack, onSync }: ParentsScreenProps) => {
  const [profiles, setProfiles] = useState<ProfileMeta[]>(listProfiles);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Profiles left by the old sync bug (same name twice, or a "Moi" holding a child's stickers).
  const [suggestions, setSuggestions] = useState(() => suggestSameChild(loadProgress()));
  const refresh = () => {
    setProfiles(listProfiles());
    setSuggestions(suggestSameChild(loadProgress()));
  };

  const add = () => {
    const used = new Set(profiles.map((p) => p.avatar));
    addProfile("", AVATARS.find((a) => !used.has(a)) ?? AVATARS[0]);
    refresh();
  };

  return (
    <BathroomBackground>
      <div className="flex flex-col items-center flex-1 px-4 pt-4 pb-24 gap-4">
        <div className="w-full max-w-md flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-14 h-14 shrink-0 rounded-full bg-white/80 hover:bg-white border-[3px] border-ink/15 shadow-md flex items-center justify-center text-2xl text-ink"
            aria-label="Retour"
          >
            ←
          </button>
          <h1 className="text-3xl font-display font-bold sticker-title">Espace parents</h1>
        </div>
        <p className="w-full max-w-md text-sm font-body font-semibold text-muted-foreground">
          Un profil par enfant (jusqu'à {MAX_PROFILES}). Les prénoms et les autocollants restent sur ce téléphone.
        </p>

        {suggestions.map((sg) => (
          <SameChildCard key={sg.other.id} suggestion={sg} onChange={refresh} />
        ))}

        <ul className="w-full max-w-md flex flex-col gap-3">
          {profiles.map((p) => {
            const stickers = getProfile(p.id).stickers.length;
            return (
              <li key={p.id} className="bg-white border-[3px] border-ink rounded-3xl p-3 flex flex-col gap-3 shadow-[0_4px_0_hsl(var(--ink)/0.15)]">
                <div className="flex items-center gap-3">
                  <span className="text-5xl leading-none" aria-hidden>
                    {p.avatar}
                  </span>
                  <input
                    value={p.name}
                    onChange={(e) => {
                      updateProfile(p.id, { name: e.target.value });
                      setProfiles((list) => list.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)));
                      setSuggestions(suggestSameChild(loadProgress()));
                    }}
                    placeholder="Prénom ou surnom"
                    maxLength={20}
                    aria-label="Prénom ou surnom"
                    className="flex-1 min-w-0 h-12 rounded-2xl border-2 border-ink/20 px-3 font-display font-semibold text-lg text-ink bg-tile/50 focus:outline-none focus:border-ink"
                  />
                  <button
                    onClick={() => setConfirmDelete(p.id)}
                    disabled={profiles.length <= 1}
                    className="w-12 h-12 shrink-0 rounded-full border-2 border-ink/20 text-xl disabled:opacity-30"
                    aria-label={`Supprimer ${p.name || "ce profil"}`}
                  >
                    🗑
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={p.avatar === a}
                      aria-label={`Avatar ${a}`}
                      onClick={() => (updateProfile(p.id, { avatar: a }), refresh())}
                      className={cn(
                        "w-10 h-10 rounded-full text-2xl flex items-center justify-center",
                        p.avatar === a ? "bg-mint border-2 border-ink" : "bg-tile/60",
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {confirmDelete === p.id && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-bubblegum/20 p-3">
                    <p className="font-body font-semibold text-ink">
                      Supprimer {p.name || "ce profil"} et ses {stickers} autocollant{stickers > 1 ? "s" : ""}{"\u00A0"}?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          deleteProfile(p.id);
                          setConfirmDelete(null);
                          refresh();
                        }}
                      >
                        Oui, supprimer
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                        Non
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {profiles.length < MAX_PROFILES && (
          <Button variant="default" onClick={add}>
            + Ajouter un enfant
          </Button>
        )}

        <div className="w-full max-w-md bg-white border-[3px] border-ink rounded-3xl p-4 flex flex-col gap-3 shadow-[0_4px_0_hsl(var(--ink)/0.15)]">
          <p className="font-display font-bold text-lg text-ink">📱 Deux téléphones ?</p>
          <p className="text-sm font-body font-semibold text-muted-foreground">
            Gardez les mêmes autocollants et le même calendrier sur le téléphone de l'autre parent : chacun scanne le QR code de l'autre, sans internet.
          </p>
          <Button variant="secondary" onClick={onSync}>
            Synchroniser avec un autre téléphone
          </Button>
        </div>

        <section
          aria-label="Dentifrice : les repères"
          className="w-full max-w-md bg-white border-[3px] border-ink rounded-3xl p-4 flex flex-col gap-2 shadow-[0_4px_0_hsl(var(--ink)/0.15)]"
        >
          <h2 className="font-display font-bold text-lg text-ink">{PARENT_TIP.title}</h2>
          {PARENT_TIP.lines.map((line) => (
            <p key={line} className="text-sm font-body font-semibold text-ink/90">
              {line}
            </p>
          ))}
          <p className="text-xs font-body font-semibold text-muted-foreground">{PARENT_TIP.sources}</p>
        </section>

        <p className="w-full max-w-md text-xs font-body font-semibold text-muted-foreground text-center">
          Voix de Quenottes : elevenlabs.io
        </p>
      </div>
    </BathroomBackground>
  );
};

export default ParentsScreen;
