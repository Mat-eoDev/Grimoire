import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { SessionPayload } from "../lib/types";

type HomePageProps = {
  session: SessionPayload | null;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function HomePage({ session, onSessionRefresh, onLogout }: HomePageProps) {
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", username: "", password: "" });
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        json: loginForm
      });
      await onSessionRefresh();
      setMessage("Connexion reussie.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Connexion impossible");
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/auth/register", {
        method: "POST",
        json: registerForm
      });
      await onSessionRefresh();
      setMessage("Compte cree et session ouverte.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Creation de compte impossible");
    }
  }

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const payload = await apiFetch<{ campaign: { id: string } }>("/campaigns", {
        method: "POST",
        json: campaignForm
      });
      await onSessionRefresh();
      navigate(`/campaigns/${payload.campaign.id}/mj`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Creation de campagne impossible");
    }
  }

  return (
    <div className="app-shell">
      <div className="hero-band">
        <div>
          <p className="eyebrow">NewMJ</p>
          <h1>Le pupitre du maitre du jeu, en direct avec les joueurs.</h1>
          <p className="hero-copy">
            Cree une campagne, valide les personnages, projette une scene, pilote un combat et diffuse
            instantanement la vue joueur.
          </p>
        </div>
      </div>

      {error ? <div className="feedback feedback--error">{error}</div> : null}
      {message ? <div className="feedback feedback--success">{message}</div> : null}

      {!session ? (
        <div className="two-column-grid">
          <section className="section-card">
            <header className="section-card__header">
              <div>
                <h2>Connexion</h2>
                <p>Reviens sur ta table en cours.</p>
              </div>
            </header>
            <div className="section-card__body">
              <form className="stack-form" onSubmit={handleLogin}>
                <label>
                  Email
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    required
                  />
                </label>
                <button type="submit">Se connecter</button>
              </form>
            </div>
          </section>

          <section className="section-card">
            <header className="section-card__header">
              <div>
                <h2>Nouveau compte</h2>
                <p>Prepare ton acces MJ ou joueur.</p>
              </div>
            </header>
            <div className="section-card__body">
              <form className="stack-form" onSubmit={handleRegister}>
                <label>
                  Email
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Pseudo
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                    required
                  />
                </label>
                <button type="submit">Creer le compte</button>
              </form>
            </div>
          </section>
        </div>
      ) : (
        <div className="stack-layout">
          <section className="section-card">
            <header className="section-card__header">
              <div>
                <h2>Bienvenue, {session.user.username}</h2>
                <p>{session.user.email}</p>
              </div>
              <div className="toolbar">
                <button className="button-ghost" onClick={() => void onSessionRefresh()}>
                  Actualiser
                </button>
                <button className="button-ghost" onClick={() => void onLogout()}>
                  Se deconnecter
                </button>
              </div>
            </header>
            <div className="section-card__body">
              <form className="stack-form" onSubmit={handleCreateCampaign}>
                <label>
                  Titre de campagne
                  <input
                    type="text"
                    value={campaignForm.title}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={3}
                    value={campaignForm.description}
                    onChange={(event) =>
                      setCampaignForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <button type="submit">Creer une campagne</button>
              </form>
            </div>
          </section>

          <section className="section-card">
            <header className="section-card__header">
              <div>
                <h2>Mes campagnes</h2>
                <p>Entre soit en poste MJ, soit dans la vue joueur.</p>
              </div>
            </header>
            <div className="section-card__body">
              <div className="campaign-grid">
                {session.campaigns.map((entry) => (
                  <article className="campaign-tile" key={entry.memberId}>
                    <div>
                      <p className="eyebrow">{entry.role === "GM" ? "MJ" : "JOUEUR"}</p>
                      <h3>{entry.campaign.title}</h3>
                      <p>{entry.campaign.description || "Aucune description."}</p>
                    </div>
                    <div className="pill-row">
                      <span className="pill">{entry.campaign.status}</span>
                      <span className="pill">{entry.campaign.memberCount} membres</span>
                    </div>
                    <button
                      onClick={() =>
                        navigate(
                          `/campaigns/${entry.campaign.id}/${entry.role === "GM" ? "mj" : "player"}`
                        )
                      }
                    >
                      Ouvrir la campagne
                    </button>
                  </article>
                ))}
                {session.campaigns.length === 0 ? (
                  <p className="empty-state">Aucune campagne pour le moment. Cree la premiere table.</p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

