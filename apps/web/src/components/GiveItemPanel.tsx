import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { Item, InventoryEntry, CampaignMemberView } from "../lib/types";

type Props = {
  campaignId: string;
  players: CampaignMemberView[];
};

const TYPE_LABELS: Record<string, string> = {
  WEAPON: "Armes",
  SHIELD: "Boucliers",
  CONSUMABLE: "Consommables",
  MISC: "Divers",
};

type Bonuses = {
  bonusMaxHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusSpeed: number;
  bonusMagic: number;
  effectHp: number;
};

const EQUIP_BONUS_FIELDS: { key: keyof Bonuses; label: string; icon: string }[] = [
  { key: "bonusMaxHp",   label: "PV max",  icon: "❤️" },
  { key: "bonusAttack",  label: "Attaque", icon: "⚔️" },
  { key: "bonusDefense", label: "Défense", icon: "🛡️" },
  { key: "bonusSpeed",   label: "Vitesse", icon: "💨" },
  { key: "bonusMagic",   label: "Magie",   icon: "🔮" },
];

const ZERO_BONUSES: Bonuses = {
  bonusMaxHp: 0, bonusAttack: 0, bonusDefense: 0, bonusSpeed: 0, bonusMagic: 0, effectHp: 0,
};

export function GiveItemPanel({ campaignId, players }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const onlyPlayers = players.filter((m) => m.role === "PLAYER");
  const [selectedPlayerId, setSelectedPlayerId] = useState(onlyPlayers[0]?.user.id ?? "");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [bonuses, setBonuses] = useState<Bonuses>(ZERO_BONUSES);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch<{ items: Item[] }>(`/campaigns/${campaignId}/items`)
      .then((d) => {
        setItems(d.items);
        if (d.items[0]) setSelectedSlug(d.items[0].slug);
      })
      .catch(() => {});
  }, [campaignId]);

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
    if (!selectedPlayerId || !selectedSlug) return;
    setStatus("loading");
    setMessage("");
    try {
      const data = await apiFetch<{ entry: InventoryEntry }>(
        `/campaigns/${campaignId}/inventory/give`,
        { method: "POST", json: { playerId: selectedPlayerId, itemSlug: selectedSlug, quantity, ...bonuses } }
      );
      const player = onlyPlayers.find((p) => p.user.id === selectedPlayerId);
      setStatus("success");
      setMessage(`${data.entry.item.name} donné à ${player?.user.username ?? "joueur"} !`);
      setBonuses(ZERO_BONUSES);
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="give-panel">
      <h3 className="give-panel-title">Donner un objet</h3>

      <div className="give-panel-form">
        <label className="give-label">
          Joueur
          <select className="give-select" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
            {onlyPlayers.map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
            ))}
          </select>
        </label>

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
                  value={bonuses.effectHp || ""}
                  placeholder="0"
                  onChange={(e) => setBonus("effectHp", e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {selectedItem?.equipable && (
          <div className="give-bonuses">
            <p className="give-bonuses-title">Bonus (quand équipé)</p>
            <div className="give-bonuses-grid">
              {EQUIP_BONUS_FIELDS.map(({ key, label, icon }) => (
                <label key={key} className="give-bonus-label">
                  <span>{icon} {label}</span>
                  <input
                    className="give-input give-input--bonus"
                    type="number"
                    min={0}
                    max={99}
                    value={bonuses[key] || ""}
                    placeholder="0"
                    onChange={(e) => setBonus(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="give-btn" onClick={handleGive}
          disabled={status === "loading" || !selectedPlayerId || !selectedSlug}>
          {status === "loading" ? "Envoi..." : "Donner"}
        </button>

        {message && <p className={`give-message give-message--${status}`}>{message}</p>}
      </div>
    </div>
  );
}
