import { useState } from "react";

export type CharacterChoice = {
  charId: number;
  name: string;
};

type Props = {
  onConfirm: (choice: CharacterChoice) => void;
};

const CHARACTERS = [1, 2, 3, 4];

export function CharacterSelect({ onConfirm }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (selected === null) {
      setError("Choisis un personnage.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Le nom doit faire au moins 2 caractères.");
      return;
    }
    onConfirm({ charId: selected, name: name.trim() });
  }

  return (
    <div className="app-shell">
      <div className="char-select-wrapper">
        <h1 className="char-select-title">Choix du Personnage</h1>
        <p className="char-select-subtitle">Sélectionne ton personnage puis entre son nom.</p>

        <div className="char-grid">
          {CHARACTERS.map((id) => (
            <button
              key={id}
              type="button"
              className={`char-card${selected === id ? " char-card--selected" : ""}`}
              onClick={() => {
                setSelected(id);
                setError(null);
              }}
            >
              <div className="char-card__avatar">
                <span className="char-card__number">{id}</span>
              </div>
              <span className="char-card__label">Personnage {id}</span>
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
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </label>
        </div>

        {error && <p className="char-error">{error}</p>}

        <button
          type="button"
          className="char-confirm-btn"
          onClick={handleConfirm}
        >
          Confirmer
        </button>
      </div>
    </div>
  );
}
