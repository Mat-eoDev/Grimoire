import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { SessionPayload } from "../lib/types";

type InvitePageProps = {
  session: SessionPayload | null;
  onSessionRefresh: () => Promise<void>;
};

export function InvitePage({ session, onSessionRefresh }: InvitePageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function acceptInvite() {
    if (!params.token) {
      return;
    }

    try {
      const payload = await apiFetch<{ member: { campaignId: string } }>(`/invites/${params.token}/accept`, {
        method: "POST"
      });
      await onSessionRefresh();
      setMessage("Invitation acceptee.");
      navigate(`/campaigns/${payload.member.campaignId}/player`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Invitation invalide");
    }
  }

  return (
    <div className="app-shell">
      <section className="section-card section-card--narrow">
        <header className="section-card__header">
          <div>
            <p className="eyebrow">Invitation</p>
            <h2>Rejoindre la campagne</h2>
            <p>Le lien d'invitation ajoute ton compte a la table cible.</p>
          </div>
        </header>
        <div className="section-card__body">
          {!session ? (
            <p>
              Connecte-toi ou cree un compte avant d'accepter l'invitation. <Link to="/">Retour a l'accueil</Link>
            </p>
          ) : (
            <>
              <p>Compte connecte : {session.user.email}</p>
              <button onClick={() => void acceptInvite()}>Accepter l'invitation</button>
            </>
          )}
          {error ? <div className="feedback feedback--error">{error}</div> : null}
          {message ? <div className="feedback feedback--success">{message}</div> : null}
        </div>
      </section>
    </div>
  );
}
