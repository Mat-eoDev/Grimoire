import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { MjDashboard } from "../components/MjDashboard";
import { PlayerDashboard } from "../components/PlayerDashboard";
import { apiFetch } from "../lib/api";
import { subscribeToCampaign } from "../lib/events";
import type { CampaignPayload, SessionPayload } from "../lib/types";

type CampaignPageProps = {
  session: SessionPayload;
  expectedRole: "GM" | "PLAYER";
  onLogout: () => Promise<void>;
};

export function CampaignPage({ session, expectedRole, onLogout }: CampaignPageProps) {
  const params = useParams();
  const campaignId = params.campaignId ?? "";
  const [payload, setPayload] = useState<CampaignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCampaign() {
    if (!campaignId) {
      return;
    }

    try {
      const nextPayload = await apiFetch<CampaignPayload>(`/campaigns/${campaignId}`);
      setPayload(nextPayload);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadCampaign();
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) {
      return undefined;
    }

    return subscribeToCampaign(campaignId, () => {
      void loadCampaign();
    });
  }, [campaignId]);

  if (loading) {
    return <div className="app-shell loading-screen">Connexion a la campagne...</div>;
  }

  if (error) {
    return (
      <div className="app-shell">
        <div className="feedback feedback--error">{error}</div>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  if (!payload) {
    return <div className="app-shell">Campagne introuvable.</div>;
  }

  if (payload.viewer.role !== expectedRole) {
    return <Navigate to={`/campaigns/${campaignId}/${payload.viewer.role === "GM" ? "mj" : "player"}`} replace />;
  }

  return (
    <div className="app-shell">
      <header className="campaign-header">
        <div>
          <p className="eyebrow">{expectedRole === "GM" ? "Zone MJ" : "Zone joueur"}</p>
          <h1>{payload.campaign.title}</h1>
          <p>{payload.campaign.description || "Aucune description pour cette campagne."}</p>
        </div>
        <div className="toolbar">
          <span className="pill">{session.user.username}</span>
          <button className="button-ghost" onClick={() => void loadCampaign()}>
            Actualiser
          </button>
          <Link className="button-link" to="/">
            Accueil
          </Link>
          <button className="button-ghost" onClick={() => void onLogout()}>
            Quitter
          </button>
        </div>
      </header>

      {expectedRole === "GM" ? (
        <MjDashboard payload={payload} reload={loadCampaign} />
      ) : (
        <PlayerDashboard payload={payload} reload={loadCampaign} />
      )}
    </div>
  );
}
