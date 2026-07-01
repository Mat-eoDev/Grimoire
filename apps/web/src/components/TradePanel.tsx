import { useEffect, useState, useCallback } from "react";
import { apiFetch, API_URL } from "../lib/api";
import type { TradeOffer, InventoryEntry, CampaignMemberView } from "../lib/types";

type NpcTarget = { id: string; name: string; type: string };

type Props = {
  campaignId: string;
  currentUserId: string;
  members: CampaignMemberView[];
  npcTargets?: NpcTarget[];
};

export function TradePanel({ campaignId, currentUserId, members, npcTargets = [] }: Props) {
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const players = members.filter((m) => m.role === "PLAYER" && m.user.id !== currentUserId);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ trades: TradeOffer[] }>(`/campaigns/${campaignId}/trades/pending`);
      setTrades(data.trades);
    } catch {}
    finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // SSE: refresh on trade events
  useEffect(() => {
    const es = new EventSource(`${API_URL}/campaigns/${campaignId}/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data as string) as { type: string };
        if (ev.type.startsWith("trade:")) load();
      } catch {}
    };
    return () => es.close();
  }, [campaignId, load]);

  async function act(tradeId: string, action: "accept" | "refuse" | "cancel") {
    setActionId(tradeId);
    try {
      await apiFetch(`/campaigns/${campaignId}/trades/${tradeId}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally { setActionId(null); }
  }

  const incoming = trades.filter((t) => t.toUserId === currentUserId);
  const outgoing = trades.filter((t) => t.fromUserId === currentUserId);

  if (loading) return null;
  if (trades.length === 0 && players.length === 0 && npcTargets.length === 0) return null;

  return (
    <div className="trade-panel">
      <h3 className="trade-panel__title">⚖️ Échanges</h3>

      {incoming.length > 0 && (
        <section className="trade-section">
          <h4 className="trade-section__label">Propositions reçues</h4>
          {incoming.map((t) => (
            <TradeCard key={t.id} trade={t} side="incoming" busy={actionId === t.id}
              onAccept={() => act(t.id, "accept")}
              onRefuse={() => act(t.id, "refuse")} />
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="trade-section">
          <h4 className="trade-section__label">Propositions envoyées</h4>
          {outgoing.map((t) => (
            <TradeCard key={t.id} trade={t} side="outgoing" busy={actionId === t.id}
              onCancel={() => act(t.id, "cancel")} />
          ))}
        </section>
      )}

      {(players.length > 0 || npcTargets.length > 0) && (
        <TradeForm campaignId={campaignId} currentUserId={currentUserId} players={players} npcTargets={npcTargets} onDone={load} />
      )}
    </div>
  );
}

function TradeCard({
  trade, side, busy,
  onAccept, onRefuse, onCancel
}: {
  trade: TradeOffer;
  side: "incoming" | "outgoing";
  busy: boolean;
  onAccept?: () => void;
  onRefuse?: () => void;
  onCancel?: () => void;
}) {
  const isGift = !trade.requestedEntryId;
  return (
    <div className="trade-card">
      <div className="trade-card__header">
        {side === "incoming"
          ? <span><strong>{trade.fromUsername}</strong> te propose {isGift ? "un don" : "un échange"}</span>
          : <span>Tu proposes {isGift ? "un don" : "un échange"} à <strong>{trade.toUsername}</strong></span>}
      </div>
      <div className="trade-card__items">
        <TradeItem entry={trade.offeredEntry} qty={trade.offeredQty} label={side === "incoming" ? "Offre" : "Tu offres"} />
        {!isGift && trade.requestedEntry && (
          <>
            <span className="trade-card__arrow">⇄</span>
            <TradeItem entry={trade.requestedEntry} qty={trade.requestedQty} label={side === "incoming" ? "Demande" : "Tu veux"} />
          </>
        )}
      </div>
      {side === "incoming" && (
        <div className="trade-card__actions">
          <button className="trade-btn trade-btn--accept" disabled={busy} onClick={onAccept}>✓ Accepter</button>
          <button className="trade-btn trade-btn--refuse" disabled={busy} onClick={onRefuse}>✕ Refuser</button>
        </div>
      )}
      {side === "outgoing" && (
        <div className="trade-card__actions">
          <button className="trade-btn trade-btn--cancel" disabled={busy} onClick={onCancel}>Annuler</button>
        </div>
      )}
    </div>
  );
}

function TradeItem({ entry, qty, label }: { entry: InventoryEntry | null; qty: number; label: string }) {
  if (!entry) return <span className="trade-item trade-item--missing">Objet introuvable</span>;
  return (
    <div className="trade-item">
      <img src={`/lib_picture/items/${entry.item.imageFile}`} alt={entry.item.name} className="trade-item__img" />
      <div>
        <span className="trade-item__label">{label}</span>
        <strong>{entry.item.name}{qty > 1 ? ` ×${qty}` : ""}</strong>
      </div>
    </div>
  );
}

type TradeFormProps = {
  campaignId: string;
  currentUserId: string;
  players: CampaignMemberView[];
  npcTargets: NpcTarget[];
  onDone: () => void;
};

function TradeForm({ campaignId, players, npcTargets, onDone }: TradeFormProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"gift" | "trade">("gift");
  const firstTarget = players[0]
    ? `player:${players[0].user.id}`
    : npcTargets[0]
      ? `npc:${npcTargets[0].id}`
      : "";
  const [target, setTarget] = useState(firstTarget);
  const [myEntries, setMyEntries] = useState<InventoryEntry[]>([]);
  const [theirEntries, setTheirEntries] = useState<InventoryEntry[]>([]);
  const [offeredEntryId, setOfferedEntryId] = useState("");
  const [offeredQty, setOfferedQty] = useState(1);
  const [requestedEntryId, setRequestedEntryId] = useState("");
  const [requestedQty, setRequestedQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isNpc = target.startsWith("npc:");
  const targetId = target.split(":")[1] ?? "";
  const effectiveMode = isNpc ? "gift" : mode;

  useEffect(() => {
    if (!open) return;
    apiFetch<{ entries: InventoryEntry[] }>(`/campaigns/${campaignId}/inventory`)
      .then((d) => { setMyEntries(d.entries); if (d.entries[0]) setOfferedEntryId(d.entries[0].id); })
      .catch(() => {});
  }, [open, campaignId]);

  useEffect(() => {
    if (!open || !targetId || isNpc) { setTheirEntries([]); return; }
    setTheirEntries([]);
    setRequestedEntryId("");
    apiFetch<{ entries: InventoryEntry[] }>(`/campaigns/${campaignId}/players/${targetId}/inventory`)
      .then((d) => { setTheirEntries(d.entries); if (d.entries[0]) setRequestedEntryId(d.entries[0].id); })
      .catch(() => {});
  }, [open, targetId, isNpc, campaignId]);

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      if (isNpc) {
        const data = await apiFetch<{ to: string; item: string }>(
          `/campaigns/${campaignId}/inventory/give-npc`,
          { method: "POST", json: { entryId: offeredEntryId, targetElementId: targetId, qty: offeredQty } }
        );
        setMsg(`✓ ${data.item} donné à ${data.to}.`);
      } else if (mode === "gift") {
        const data = await apiFetch<{ to: string }>(
          `/campaigns/${campaignId}/inventory/player-give`,
          { method: "POST", json: { entryId: offeredEntryId, toUserId: targetId, qty: offeredQty } }
        );
        setMsg(`✓ Don envoyé à ${data.to} !`);
      } else {
        await apiFetch(`/campaigns/${campaignId}/trades`, {
          method: "POST",
          json: {
            toUserId: targetId,
            offeredEntryId,
            offeredQty,
            requestedEntryId: requestedEntryId || null,
            requestedQty
          }
        });
        setMsg("✓ Proposition envoyée !");
      }
      onDone();
      setTimeout(() => { setMsg(""); setOpen(false); }, 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="trade-open-btn" onClick={() => setOpen(true)}>
        + Donner / Proposer un échange
      </button>
    );
  }

  const offeredEntry = myEntries.find((e) => e.id === offeredEntryId);

  return (
    <div className="trade-form">
      <div className="trade-form__mode">
        <button className={`trade-mode-btn${effectiveMode === "gift" ? " trade-mode-btn--active" : ""}`} onClick={() => setMode("gift")}>🎁 Don</button>
        <button className={`trade-mode-btn${effectiveMode === "trade" ? " trade-mode-btn--active" : ""}`} onClick={() => !isNpc && setMode("trade")} disabled={isNpc}>⚖️ Échange</button>
      </div>

      <label className="trade-form__label">
        Destinataire
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {players.length > 0 && (
            <optgroup label="Joueurs">
              {players.map((p) => <option key={p.user.id} value={`player:${p.user.id}`}>{p.user.username}</option>)}
            </optgroup>
          )}
          {npcTargets.length > 0 && (
            <optgroup label="Personnages de la scène">
              {npcTargets.map((n) => <option key={n.id} value={`npc:${n.id}`}>{n.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>

      {isNpc && (
        <p className="trade-form__hint">Don narratif : l'objet quitte ton sac (le personnage n'a pas d'inventaire réel).</p>
      )}

      <label className="trade-form__label">
        {effectiveMode === "gift" ? "Objet à donner" : "Mon objet"}
        {myEntries.length === 0
          ? <span style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>Inventaire vide</span>
          : <select value={offeredEntryId} onChange={(e) => setOfferedEntryId(e.target.value)}>
              {myEntries.map((e) => <option key={e.id} value={e.id}>{e.item.name}{e.quantity > 1 ? ` ×${e.quantity}` : ""}</option>)}
            </select>}
      </label>

      {offeredEntry && offeredEntry.quantity > 1 && (
        <label className="trade-form__label">
          Quantité à {effectiveMode === "gift" ? "donner" : "offrir"}
          <input type="number" min={1} max={offeredEntry.quantity} value={offeredQty}
            onChange={(e) => setOfferedQty(Math.max(1, Math.min(offeredEntry.quantity, Number(e.target.value))))} />
        </label>
      )}

      {effectiveMode === "trade" && (
        <>
          <label className="trade-form__label">
            Objet demandé (de {players.find((p) => p.user.id === targetId)?.user.username})
            {theirEntries.length === 0
              ? <span style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>Inventaire vide</span>
              : <select value={requestedEntryId} onChange={(e) => setRequestedEntryId(e.target.value)}>
                  {theirEntries.map((e) => <option key={e.id} value={e.id}>{e.item.name}{e.quantity > 1 ? ` ×${e.quantity}` : ""}</option>)}
                </select>}
          </label>
          {(theirEntries.find((e) => e.id === requestedEntryId)?.quantity ?? 0) > 1 && (
            <label className="trade-form__label">
              Quantité demandée
              <input type="number" min={1} max={theirEntries.find((e) => e.id === requestedEntryId)?.quantity ?? 1}
                value={requestedQty}
                onChange={(e) => setRequestedQty(Math.max(1, Number(e.target.value)))} />
            </label>
          )}
        </>
      )}

      {msg && <p className="trade-form__msg">{msg}</p>}

      <div className="trade-form__actions">
        <button className="trade-btn trade-btn--cancel" onClick={() => setOpen(false)}>Annuler</button>
        <button className="trade-btn trade-btn--accept" disabled={busy || !offeredEntryId || (effectiveMode === "trade" && !requestedEntryId)} onClick={submit}>
          {busy ? "..." : effectiveMode === "gift" ? "Donner" : "Proposer"}
        </button>
      </div>
    </div>
  );
}
