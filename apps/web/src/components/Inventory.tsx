import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { InventoryEntry } from "../lib/types";

type Props = {
  campaignId: string;
  refreshKey?: number;
};

const TYPE_LABELS: Record<string, string> = {
  WEAPON: "Arme",
  SHIELD: "Bouclier",
  CONSUMABLE: "Consommable",
  MISC: "Divers",
};

export function Inventory({ campaignId, refreshKey }: Props) {
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ entries: InventoryEntry[] }>(
        `/campaigns/${campaignId}/inventory`
      );
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [campaignId, refreshKey]);

  async function useConsumable(entry: InventoryEntry) {
    try {
      const data = await apiFetch<{ hp: number; maxHp: number }>(
        `/campaigns/${campaignId}/inventory/${entry.id}/use`,
        { method: "POST" }
      );
      setEntries((prev) => {
        const updated = prev.find((e) => e.id === entry.id);
        if (!updated) return prev;
        if (updated.quantity > 1) {
          return prev.map((e) => e.id === entry.id ? { ...e, quantity: e.quantity - 1 } : e);
        }
        return prev.filter((e) => e.id !== entry.id);
      });
      alert(`❤️ +${entry.effectHp} PV ! (${data.hp} / ${data.maxHp})`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function toggleEquip(entry: InventoryEntry) {
    if (!entry.item.equipable) return;
    try {
      const data = await apiFetch<{ entry: InventoryEntry }>(
        `/campaigns/${campaignId}/inventory/${entry.id}/equip`,
        { method: "PATCH" }
      );
      setEntries((prev) =>
        prev.map((e) => {
          if (e.item.type === data.entry.item.type && e.id !== data.entry.id) {
            return { ...e, equipped: false };
          }
          return e.id === data.entry.id ? data.entry : e;
        })
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function removeEntry(entryId: string) {
    try {
      await apiFetch(`/campaigns/${campaignId}/inventory/${entryId}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  }

  if (loading) return <div className="inventory-loading">Chargement...</div>;
  if (error) return <div className="inventory-error">{error}</div>;

  const equipped = entries.filter((e) => e.equipped);
  const unequipped = entries.filter((e) => !e.equipped);

  return (
    <div className="inventory">
      <h2 className="inventory-title">Inventaire</h2>

      {entries.length === 0 && (
        <p className="inventory-empty">Ton inventaire est vide.</p>
      )}

      {equipped.length > 0 && (
        <section className="inventory-section">
          <h3 className="inventory-section-title">Équipé</h3>
          <div className="inventory-grid">
            {equipped.map((entry) => (
              <ItemCard
                key={entry.id}
                entry={entry}
                onEquip={toggleEquip}
                onRemove={removeEntry}
                onUse={useConsumable}
              />
            ))}
          </div>
        </section>
      )}

      {unequipped.length > 0 && (
        <section className="inventory-section">
          <h3 className="inventory-section-title">Sac</h3>
          <div className="inventory-grid">
            {unequipped.map((entry) => (
              <ItemCard
                key={entry.id}
                entry={entry}
                onEquip={toggleEquip}
                onRemove={removeEntry}
                onUse={useConsumable}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const BONUS_LABELS: { key: keyof InventoryEntry; label: string; icon: string }[] = [
  { key: "bonusMaxHp",   label: "PV max",  icon: "❤️" },
  { key: "bonusAttack",  label: "Attaque", icon: "⚔️" },
  { key: "bonusDefense", label: "Défense", icon: "🛡️" },
  { key: "bonusSpeed",   label: "Vitesse", icon: "💨" },
  { key: "bonusMagic",   label: "Magie",   icon: "🔮" },
];

function ItemBonuses({ entry }: { entry: InventoryEntry }) {
  const active = BONUS_LABELS.filter(({ key }) => (entry[key] as number) > 0);
  if (active.length === 0) return null;
  return (
    <div className="item-bonuses">
      {active.map(({ key, label, icon }) => (
        <span key={key} className="item-bonus-tag">
          {icon} +{entry[key] as number} {label}
        </span>
      ))}
    </div>
  );
}

type CardProps = {
  entry: InventoryEntry;
  onEquip: (entry: InventoryEntry) => void;
  onRemove: (id: string) => void;
  onUse: (entry: InventoryEntry) => void;
};

function ItemCard({ entry, onEquip, onRemove, onUse }: CardProps) {
  const { item } = entry;
  return (
    <div className={`item-card ${entry.equipped ? "item-card--equipped" : ""}`}>
      <div className="item-card-img-wrap">
        <img
          src={`/lib_picture/items/${item.imageFile}`}
          alt={item.name}
          className="item-card-img"
        />
        {entry.quantity > 1 && (
          <span className="item-card-qty">×{entry.quantity}</span>
        )}
        {entry.equipped && <span className="item-card-badge">Équipé</span>}
      </div>
      <div className="item-card-info">
        <span className="item-card-name">{item.name}</span>
        <span className="item-card-type">{TYPE_LABELS[item.type] ?? item.type}</span>
        <p className="item-card-desc">{item.description}</p>
        <ItemBonuses entry={entry} />
      </div>
      <div className="item-card-actions">
        {item.type === "CONSUMABLE" && (
          <button className="item-btn item-btn--use" onClick={() => onUse(entry)}>
            {entry.effectHp > 0 ? `+${entry.effectHp} PV` : "Utiliser"}
          </button>
        )}
        {item.equipable && (
          <button
            className={`item-btn ${entry.equipped ? "item-btn--unequip" : "item-btn--equip"}`}
            onClick={() => onEquip(entry)}
          >
            {entry.equipped ? "Déséquiper" : "Équiper"}
          </button>
        )}
        <button className="item-btn item-btn--remove" onClick={() => onRemove(entry.id)}>
          Jeter
        </button>
      </div>
    </div>
  );
}
