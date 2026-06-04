import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api";

type Sheet = {
  charId:   number;
  charName: string;
  hp:       number;
  maxHp:    number;
  attack:   number;
  defense:  number;
  speed:    number;
  magic:    number;
  level:    number;
};

const CHAR_IMGS: Record<number, string> = {
  1: "/ASSASSIN.png",
  2: "/CHEVALIER.png",
  3: "/ELFE.png",
  4: "/MAG.png",
};

const CHAR_LABELS: Record<number, string> = {
  1: "Assassin",
  2: "Chevalier",
  3: "Elfe",
  4: "Mage",
};

const STATS = [
  { key: "attack",  label: "Attaque",  icon: "⚔️", max: 25 },
  { key: "defense", label: "Défense",  icon: "🛡️", max: 25 },
  { key: "speed",   label: "Vitesse",  icon: "💨", max: 25 },
  { key: "magic",   label: "Magie",    icon: "🔮", max: 25 },
] as const;

type Props = { campaignId: string };

export function CharacterSheet({ campaignId }: Props) {
  const [sheet, setSheet]   = useState<Sheet | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ sheet: Sheet }>(`/campaigns/${campaignId}/character`)
      .then((data) => setSheet(data.sheet))
      .catch(() => setError("Impossible de charger la fiche."));
  }, [campaignId]);

  if (error)  return null;
  if (!sheet) return null;

  const hpPercent = Math.round((sheet.hp / sheet.maxHp) * 100);

  return (
    <section className="char-sheet">
      {/* En-tête */}
      <div className="char-sheet__header">
        <img
          src={CHAR_IMGS[sheet.charId]}
          alt={CHAR_LABELS[sheet.charId]}
          className="char-sheet__portrait"
        />
        <div className="char-sheet__identity">
          <p className="char-sheet__class">{CHAR_LABELS[sheet.charId]}</p>
          <h2 className="char-sheet__name">{sheet.charName}</h2>
          <span className="pill pill--warning">Niveau {sheet.level}</span>
        </div>
      </div>

      {/* PV */}
      <div className="char-sheet__hp">
        <div className="char-sheet__hp-top">
          <span>❤️ Points de Vie</span>
          <strong>{sheet.hp} / {sheet.maxHp}</strong>
        </div>
        <div className="prep-progress__bar">
          <div
            className="prep-progress__fill"
            style={{
              width: `${hpPercent}%`,
              background: hpPercent > 50
                ? "linear-gradient(90deg,#295b39,#4a9e6a)"
                : hpPercent > 25
                ? "linear-gradient(90deg,#915f14,#c97a43)"
                : "linear-gradient(90deg,#6d1f08,#a54b2a)"
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="char-sheet__stats">
        {STATS.map(({ key, label, icon, max }) => {
          const val = sheet[key];
          const pct = Math.round((val / max) * 100);
          return (
            <div key={key} className="char-sheet__stat">
              <div className="char-sheet__stat-top">
                <span>{icon} {label}</span>
                <strong>{val}</strong>
              </div>
              <div className="char-sheet__stat-bar-bg">
                <div className="char-sheet__stat-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
