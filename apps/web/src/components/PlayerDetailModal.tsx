import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { InventoryEntry, Item, CampaignMemberView } from "../lib/types";

type Sheet = {
  charId: number;
  charName: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  magic: number;
  level: number;
};

type Player = {
  userId: string;
  username: string;
  charName: string;
  charId: number;
  hp: number;
  maxHp: number;
};

type Props = {
  campaignId: string;
  player: Player;
  members: CampaignMemberView[];
  onClose: () => void;
};

const CHAR_IMGS: Record<number, string> = {
  1: "/lib_picture/player/ASSASSIN.webp",
  2: "/lib_picture/player/CHEVALIER.webp",
  3: "/lib_picture/player/ELFE.webp",
  4: "/lib_picture/player/MAG.webp",
};

const CHAR_LABELS: Record<number, string> = {
  1: "Assassin", 2: "Chevalier", 3: "Elfe", 4: "Mage",
};

const STATS = [
  { key: "attack",  label: "Attaque", icon: "⚔️", bonusKey: "bonusAttack",  max: 25 },
  { key: "defense", label: "Défense", icon: "🛡️", bonusKey: "bonusDefense", max: 25 },
  { key: "speed",   label: "Vitesse", icon: "💨", bonusKey: "bonusSpeed",   max: 25 },
  { key: "magic",   label: "Magie",   icon: "🔮", bonusKey: "bonusMagic",   max: 25 },
] as const;

const TYPE_LABELS: Record<string, string> = {
  WEAPON: "Armes", SHIELD: "Boucliers", CONSUMABLE: "Consommables", MISC: "Divers",
};

const BONUS_FIELDS: { key: keyof InventoryEntry; label: string; icon: string }[] = [
  { key: "bonusMaxHp",   label: "PV max",  icon: "❤️" },
  { key: "bonusAttack",  label: "Attaque", icon: "⚔️" },
  { key: "bonusDefense", label: "Défense", icon: "🛡️" },
  { key: "bonusSpeed",   label: "Vitesse", icon: "💨" },
  { key: "bonusMagic",   label: "Magie",   icon: "🔮" },
];

type Bonuses = { bonusMaxHp: number; bonusAttack: number; bonusDefense: number; bonusSpeed: number; bonusMagic: number; effectHp: number };
const ZERO: Bonuses = { bonusMaxHp: 0, bonusAttack: 0, bonusDefense: 0, bonusSpeed: 0, bonusMagic: 0, effectHp: 0 };

export function PlayerDetailModal({ campaignId, player, members, onClose }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Give form
  const [selectedSlug, setSelectedSlug] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [bonuses, setBonuses] = useState<Bonuses>(ZERO);
  const [giveStatus, setGiveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [giveMsg, setGiveMsg] = useState("");

  async function loadData() {
    try {
      const [sheetData, invData, itemsData] = await Promise.all([
        apiFetch<{ sheet: Sheet }>(`/campaigns/${campaignId}/players/${player.userId}/character`).catch(() => ({ sheet: null })),
        apiFetch<{ entries: InventoryEntry[] }>(`/campaigns/${campaignId}/players/${player.userId}/inventory`),
        apiFetch<{ items: Item[] }>(`/campaigns/${campaignId}/items`),
      ]);
      setSheet(sheetData.sheet);
      setEntries(invData.entries);
      setItems(itemsData.items);
      if (itemsData.items[0]) setSelectedSlug(itemsData.items[0].slug);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const equipped = entries.filter((e) => e.equipped);

  function equipBonus(key: keyof InventoryEntry) {
    return equipped.reduce((sum, e) => sum + ((e[key] as number) ?? 0), 0);
  }

  async function removeEntry(entryId: string) {
    await apiFetch(`/campaigns/${campaignId}/inventory/${entryId}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  const grouped = items.reduce<Record<string, Item[]>>((acc, item) => {
    acc[item.type] = acc[item.type] ?? [];
    acc[item.type].push(item);
    return acc;
  }, {});

  const selectedItem = items.find((i) => i.slug === selectedSlug);

  function setBonus(key: keyof Bonuses, val: string) {
    const n = parseInt(val, 10);
    setBonuses((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : Math.max(0, n) }));
  }

  async function handleGive() {
    setGiveStatus("loading");
    setGiveMsg("");
    try {
      const data = await apiFetch<{ entry: InventoryEntry }>(
        `/campaigns/${campaignId}/inventory/give`,
        { method: "POST", json: { playerId: player.userId, itemSlug: selectedSlug, quantity, ...bonuses } }
      );
      setEntries((prev) => [...prev, data.entry]);
      setBonuses(ZERO);
      setQuantity(1);
      setGiveStatus("success");
      setGiveMsg(`${data.entry.item.name} ajouté à l'inventaire !`);
      setTimeout(() => setGiveStatus("idle"), 2500);
    } catch (e) {
      setGiveStatus("error");
      setGiveMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="pdm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pdm">
        <button className="pdm-close" onClick={onClose}>✕</button>

        {/* En-tête joueur */}
        <div className="pdm-header">
          <img
            src={CHAR_IMGS[player.charId] ?? CHAR_IMGS[1]}
            alt={CHAR_LABELS[player.charId]}
            className="pdm-portrait"
          />
          <div className="pdm-identity">
            <p className="pdm-class">{CHAR_LABELS[player.charId] ?? "Personnage"}</p>
            <h2 className="pdm-name">{player.charName}</h2>
            <span className="pdm-username">@{player.username}</span>
            {sheet && <span className="pill pill--warning">Niveau {sheet.level}</span>}
          </div>
        </div>

        {loading ? (
          <p className="pdm-loading">Chargement...</p>
        ) : (
          <div className="pdm-body">

            {/* Stats */}
            {sheet && (
              <section className="pdm-section">
                <h3 className="pdm-section-title">Stats</h3>
                <div className="pdm-hp">
                  <span>❤️ PV</span>
                  <strong>
                    {sheet.hp} / {sheet.maxHp + equipBonus("bonusMaxHp")}
                    {equipBonus("bonusMaxHp") > 0 && <span className="stat-bonus"> (+{equipBonus("bonusMaxHp")})</span>}
                  </strong>
                  <div className="char-sheet__stat-bar-bg">
                    <div className="char-sheet__stat-bar-fill" style={{
                      width: `${Math.min(Math.round((sheet.hp / (sheet.maxHp + equipBonus("bonusMaxHp"))) * 100), 100)}%`
                    }} />
                  </div>
                </div>
                <div className="pdm-stats">
                  {STATS.map(({ key, label, icon, bonusKey, max }) => {
                    const b = equipBonus(bonusKey as keyof InventoryEntry);
                    const val = sheet[key] + b;
                    return (
                      <div key={key} className="pdm-stat">
                        <span>{icon} {label}</span>
                        <strong>
                          {val}
                          {b > 0 && <span className="stat-bonus"> (+{b})</span>}
                        </strong>
                        <div className="char-sheet__stat-bar-bg">
                          <div className="char-sheet__stat-bar-fill" style={{ width: `${Math.min(Math.round((val / max) * 100), 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Inventaire */}
            <section className="pdm-section">
              <h3 className="pdm-section-title">Inventaire {entries.length > 0 && `(${entries.length})`}</h3>
              {entries.length === 0 ? (
                <p className="pdm-empty">Inventaire vide.</p>
              ) : (
                <div className="pdm-inv-grid">
                  {entries.map((entry) => (
                    <div key={entry.id} className={`pdm-inv-card ${entry.equipped ? "pdm-inv-card--equipped" : ""}`}>
                      <img src={`/lib_picture/items/${entry.item.imageFile}`} alt={entry.item.name} className="pdm-inv-img" />
                      <div className="pdm-inv-info">
                        <span className="pdm-inv-name">{entry.item.name}</span>
                        {entry.quantity > 1 && <span className="pdm-inv-qty">×{entry.quantity}</span>}
                        {entry.equipped && <span className="pdm-inv-badge">Équipé</span>}
                        {BONUS_FIELDS.filter(({ key }) => (entry[key] as number) > 0).map(({ key, icon }) => (
                          <span key={key} className="item-bonus-tag">{icon} +{entry[key] as number}</span>
                        ))}
                      </div>
                      <button className="pdm-inv-remove" onClick={() => removeEntry(entry.id)} title="Retirer">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Donner un objet */}
            <section className="pdm-section">
              <h3 className="pdm-section-title">Donner un objet</h3>
              <div className="pdm-give-form">
                <label className="give-label">
                  Objet
                  <select className="give-select" value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
                    {Object.entries(grouped).map(([type, typeItems]) => (
                      <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
                        {typeItems.map((item) => (
                          <option key={item.slug} value={item.slug}>{item.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                {selectedItem && (
                  <div className="give-preview">
                    <img src={`/lib_picture/items/${selectedItem.imageFile}`} alt={selectedItem.name} className="give-preview-img" />
                    <p className="give-preview-desc">{selectedItem.description}</p>
                  </div>
                )}

                <label className="give-label">
                  Quantité
                  <input className="give-input" type="number" min={1} max={99} value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
                </label>

                {selectedItem?.type === "CONSUMABLE" && (
                  <div className="give-bonuses">
                    <p className="give-bonuses-title">Effet à l'utilisation</p>
                    <div className="give-bonuses-grid">
                      <label className="give-bonus-label">
                        <span>❤️ PV restaurés</span>
                        <input className="give-input give-input--bonus" type="number" min={0} max={999}
                          value={bonuses.effectHp || ""} placeholder="0"
                          onChange={(e) => setBonus("effectHp", e.target.value)} />
                      </label>
                    </div>
                  </div>
                )}

                {selectedItem?.equipable && (
                  <div className="give-bonuses">
                    <p className="give-bonuses-title">Bonus (quand équipé)</p>
                    <div className="give-bonuses-grid">
                      {BONUS_FIELDS.map(({ key, label, icon }) => (
                        <label key={key} className="give-bonus-label">
                          <span>{icon} {label}</span>
                          <input className="give-input give-input--bonus" type="number" min={0} max={99}
                            value={bonuses[key as keyof Bonuses] || ""}
                            placeholder="0"
                            onChange={(e) => setBonus(key as keyof Bonuses, e.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button className="give-btn" onClick={handleGive} disabled={giveStatus === "loading" || !selectedSlug}>
                  {giveStatus === "loading" ? "Envoi..." : "Donner"}
                </button>
                {giveMsg && <p className={`give-message give-message--${giveStatus}`}>{giveMsg}</p>}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
