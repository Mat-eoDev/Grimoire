import { useState } from "react";

import { apiFetch } from "../lib/api";

export type CharacterChoice = {
  charId: number;
  name: string;
};

type Props = {
  campaignId: string;
  onConfirm: (choice: CharacterChoice) => void;
};

const CHARACTERS = [
  { id: 1, label: "Assassin",  img: "/lib_picture/player/ASSASSIN.png"  },
  { id: 2, label: "Chevalier", img: "/lib_picture/player/CHEVALIER.png" },
  { id: 3, label: "Elfe",      img: "/lib_picture/player/ELFE.png"      },
  { id: 4, label: "Mage",      img: "/lib_picture/player/MAG.png"       },
];

export function CharacterSelect({ campaignId, onConfirm }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleConfirm() {
    if (selected === null) { setError("Choisis un personnage."); return; }
    if (name.trim().length < 2) { setError("Le nom doit faire au moins 2 caractères."); return; }

    setLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/character`, {
        method: "POST",
        json: { charId: selected, charName: name.trim() }
      });
      onConfirm({ charId: selected, name: name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="char-select-wrapper">
        <h1 className="char-select-title">Choix du Personnage</h1>
        <p className="char-select-subtitle">Sélectionne ton personnage puis entre son nom.</p>

        <div className="char-grid">
          {CHARACTERS.map((char) => (
            <button
              key={char.id}
              type="button"
              className={`char-card${selected === char.id ? " char-card--selected" : ""}`}
              onClick={() => { setSelected(char.id); setError(null); }}
            >
              <div className="char-card__avatar">
                <img src={char.img} alt={char.label} className="char-card__img" />
              </div>
              <span className="char-card__label">{char.label}</span>
            </button>
          ))}
        </div>

        <div className="char-name-row">
          <label className="char-name-label">
            Nom du personnage
            <input
              type="text"
              value={name}
              placeholder="Entre un nom..."
              maxLength={32}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </label>
        </div>

        {error && <p className="char-error">{error}</p>}

        <button
          type="button"
          className="char-confirm-btn"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "..." : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
