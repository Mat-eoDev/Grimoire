import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { CampaignDetail, SessionPayload } from "../lib/types";

type Props = {
  session: SessionPayload | null;
  onLogout: () => Promise<void>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "En attente",
  ACTIVE: "En cours",
  CLOSED: "Terminee"
};

export function CampaignPage({ session, onLogout }: Props) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      const result = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}`);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || data.campaign.status === "CLOSED") {
      return;
    }
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [data, load]);

  async function handleLaunch() {
    if (!campaignId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/launch`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!campaignId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/stop`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="app-shell">Chargement...</div>;
  }

  if (error || !data) {
    return (
      <div className="app-shell">
        <p className="error">{error ?? "Partie introuvable"}</p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  const isGm = data.viewer.role === "GM";
  const { campaign } = data;

  return (
    <div className="app-shell">
      <header className="campaign-header">
        <div>
          <Link to="/">&larr; Accueil</Link>
          <h1>{campaign.title}</h1>
          <p>
            MJ: {campaign.gmUser.username} — Statut: {STATUS_LABEL[campaign.status] ?? campaign.status}
          </p>
        </div>
        {session ? (
          <button type="button" onClick={onLogout}>
            Deconnexion ({session.user.username})
          </button>
        ) : (
          <Link to="/">Connexion</Link>
        )}
      </header>

      <section className="campaign-code">
        <h2>Code de la partie</h2>
        <p className="join-code">{campaign.joinCode}</p>
        <p>Partage ce code aux joueurs pour qu'ils rejoignent.</p>
      </section>

      {isGm && (
        <section className="campaign-controls">
          {campaign.status === "DRAFT" && (
            <button type="button" onClick={handleLaunch} disabled={actionLoading}>
              {actionLoading ? "..." : "Lancer la campagne"}
            </button>
          )}
          {campaign.status === "ACTIVE" && (
            <button type="button" onClick={handleStop} disabled={actionLoading}>
              {actionLoading ? "..." : "Stopper la campagne"}
            </button>
          )}
          {campaign.status === "CLOSED" && <p>Cette campagne est terminee.</p>}
        </section>
      )}

      {!isGm && (
        <section className="campaign-controls">
          {campaign.status === "DRAFT" && <p>En attente du lancement par le MJ.</p>}
          {campaign.status === "ACTIVE" && <p>La campagne est en cours !</p>}
          {campaign.status === "CLOSED" && <p>La campagne est terminee.</p>}
        </section>
      )}

      <section className="campaign-members">
        <h2>Participants ({data.members.length})</h2>
        <ul>
          {data.members.map((member) => (
            <li key={member.id}>
              {member.user.username} — {member.role === "GM" ? "MJ" : "Joueur"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
