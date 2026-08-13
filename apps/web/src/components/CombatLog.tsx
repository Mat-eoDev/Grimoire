import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "../lib/api";
import type { CombatLogEntry } from "../lib/types";

type Props = {
  campaignId: string;
  /** Incremente a chaque evenement SSE `log:appended` pour declencher un rechargement. */
  refreshKey: number;
};

const KIND_ICONS: Record<CombatLogEntry["kind"], string> = {
  ATTACK: "⚔",
  RESOLUTION: "✦"
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Journal de combat : coups portes et resolutions de jets.
 *
 * Ces traces etaient auparavant creees comme des elements de scene visibles, empiles
 * au centre du decor. Elles vivent maintenant dans leur propre table, sont lues par
 * lots bornes et s'affichent ici sans encombrer la mise en scene.
 */
export function CombatLog({ campaignId, refreshKey }: Props) {
  const [entries, setEntries] = useState<CombatLogEntry[]>([]);
  const listRef = useRef<HTMLOListElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ entries: CombatLogEntry[] }>(
        `/campaigns/${campaignId}/log?limit=30`
      );
      setEntries(data.entries);
    } catch {
      // Le journal est un confort d'affichage : son indisponibilite ne doit rien casser.
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Garde la derniere entree visible quand le journal s'allonge.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <section className="combat-log" aria-label="Journal de combat">
      <p className="live-kicker">Journal</p>
      <ol className="combat-log__list" ref={listRef} role="log" aria-live="polite">
        {entries.map((entry) => (
          <li key={entry.id} className={`combat-log__item combat-log__item--${entry.kind.toLowerCase()}`}>
            <span className="combat-log__icon" aria-hidden="true">{KIND_ICONS[entry.kind]}</span>
            <span className="combat-log__message">{entry.message}</span>
            <time className="combat-log__time" dateTime={entry.createdAt}>
              {formatTime(entry.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
