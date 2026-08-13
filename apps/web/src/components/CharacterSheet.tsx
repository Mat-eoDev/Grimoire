import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { InventoryEntry } from "../lib/types";
import { PlayerNotes } from "./PlayerNotes";

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
  1: "/lib_picture/player/ASSASSIN.png",
  2: "/lib_picture/player/CHEVALIER.png",
  3: "/lib_picture/player/ELFE.png",
  4: "/lib_picture/player/MAG.png",
};

const CHAR_LABELS: Record<number, string> = {
  1: "Assassin", 2: "Chevalier", 3: "Elfe", 4: "Mage",
};

const STATS = [
  { key: "attack",  label: "Attaque", icon: "⚔️", bonusKey: "bonusAttack",  color: "#e05a4e", max: 25 },
  { key: "defense", label: "Défense", icon: "🛡️", bonusKey: "bonusDefense", color: "#4e8ae0", max: 25 },
  { key: "speed",   label: "Vitesse", icon: "💨", bonusKey: "bonusSpeed",   color: "#4ec47a", max: 25 },
  { key: "magic",   label: "Magie",   icon: "🔮", bonusKey: "bonusMagic",   color: "#b46ee0", max: 25 },
] as const;

type Props = { campaignId: string; refreshKey?: number };

export function CharacterSheet({ campaignId, refreshKey }: Props) {
  const [sheet, setSheet]       = useState<Sheet | null>(null);
  const [equipped, setEquipped] = useState<InventoryEntry[]>([]);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ sheet: Sheet }>(`/campaigns/${campaignId}/character`),
      apiFetch<{ entries: InventoryEntry[] }>(`/campaigns/${campaignId}/inventory`),
    ])
      .then(([sheetData, invData]) => {
        setSheet(sheetData.sheet);
        setEquipped(invData.entries.filter((e) => e.equipped));
      })
      .catch(() => setError("Impossible de charger la fiche."));
  }, [campaignId, refreshKey]);

  // Les stats de la fiche sont deja effectives (base + equipement) : le serveur les
  // recalcule et les persiste a chaque changement d'equipement. Cette fonction ne sert
  // plus qu'a afficher la part apportee par l'equipement — l'additionner de nouveau
  // compterait les bonus deux fois.
  function bonus(key: keyof InventoryEntry) {
    return equipped.reduce((sum, e) => sum + ((e[key] as number) ?? 0), 0);
  }

  if (error)  return <p className="cs-error">Fiche introuvable.</p>;
  if (!sheet) return null;

  const effectiveMaxHp = sheet.maxHp;
  const hpPct = effectiveMaxHp > 0
    ? Math.min(Math.round((sheet.hp / effectiveMaxHp) * 100), 100)
    : 0;
  const hpColor = hpPct > 60 ? "#4ec47a" : hpPct > 30 ? "#e0934e" : "#e05a4e";

  return (
    <div className="cs">

      {/* ── Haut : portrait + identité ── */}
      <div className="cs-top">
        <div className="cs-portrait-wrap">
          <img
            src={CHAR_IMGS[sheet.charId]}
            alt={CHAR_LABELS[sheet.charId]}
            className="cs-portrait"
          />
        </div>

        <div className="cs-identity">
          <span className="cs-class">{CHAR_LABELS[sheet.charId]}</span>
          <h2 className="cs-name">{sheet.charName}</h2>
          <span className="cs-level">Niv. {sheet.level}</span>

          {/* PV dans la colonne identité */}
          <div className="cs-hp">
            <div className="cs-hp__head">
              <span>❤️ PV</span>
              <span>
                <strong style={{ color: hpColor }}>{sheet.hp}</strong>
                <span className="cs-hp__max"> / {effectiveMaxHp}</span>
                {bonus("bonusMaxHp") > 0 && <span className="cs-bonus"> +{bonus("bonusMaxHp")}</span>}
              </span>
            </div>
            <div className="cs-hp__track">
              <div className="cs-hp__fill" style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
          </div>

          {/* Équipement actif */}
          {equipped.length > 0 && (
            <div className="cs-equipped">
              {equipped.map((e) => (
                <div key={e.id} className="cs-equipped__chip">
                  <img src={`/lib_picture/items/${e.item.imageFile}`} alt={e.item.name} className="cs-equipped__img" />
                  <span>{e.item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="cs-stats">
        {STATS.map(({ key, label, icon, bonusKey, color, max }) => {
          const b = bonus(bonusKey as keyof InventoryEntry);
          const val = sheet[key];
          const pct = Math.min(Math.round((val / max) * 100), 100);
          return (
            <div key={key} className="cs-stat">
              <div className="cs-stat__head">
                <span className="cs-stat__icon">{icon}</span>
                <span className="cs-stat__label">{label}</span>
                <span className="cs-stat__val" style={{ color }}>
                  {val}{b > 0 && <span className="cs-bonus"> +{b}</span>}
                </span>
              </div>
              <div className="cs-stat__track">
                <div className="cs-stat__fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Notes privées ── */}
      <div className="cs-notes">
        <PlayerNotes campaignId={campaignId} />
      </div>

    </div>
  );
}
