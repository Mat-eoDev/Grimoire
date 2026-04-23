import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { CampaignSummaryResponse, SessionPayload } from "../lib/types";

type Props = {
  session: SessionPayload | null;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
};

type AuthMode = "login" | "register";

export function HomePage({ session, onSessionRefresh, onLogout }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload: Record<string, string> = { email, password };
      if (mode === "register") {
        payload.username = username;
      }
      await apiFetch(path, { method: "POST", json: payload });
      await onSessionRefresh();
      setEmail("");
      setUsername("");
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Erreur");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionLoading(true);
    try {
      const result = await apiFetch<CampaignSummaryResponse>("/campaigns", {
        method: "POST",
        json: { title }
      });
      setTitle("");
      await onSessionRefresh();
      navigate(`/campaigns/${result.campaign.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    setActionLoading(true);
    try {
      const result = await apiFetch<CampaignSummaryResponse>("/campaigns/join", {
        method: "POST",
        json: { joinCode: joinCode.trim().toUpperCase() }
      });
      setJoinCode("");
      await onSessionRefresh();
      navigate(`/campaigns/${result.campaign.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="app-shell">
        <h1>NewMJ</h1>
        <div className="auth-tabs">
          <button type="button" onClick={() => setMode("login")} disabled={mode === "login"}>
            Connexion
          </button>
          <button type="button" onClick={() => setMode("register")} disabled={mode === "register"}>
            Creer un compte
          </button>
        </div>
        <form onSubmit={handleAuth} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {mode === "register" && (
            <label>
              Pseudo
              <input value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
          )}
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
          {authError && <p className="error">{authError}</p>}
          <button type="submit" disabled={authLoading}>
            {authLoading ? "..." : mode === "login" ? "Se connecter" : "Creer le compte"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="home-header">
        <h1>Bonjour {session.user.username}</h1>
        <button type="button" onClick={onLogout}>
          Se deconnecter
        </button>
      </header>

      <section className="home-actions">
        <form onSubmit={handleCreate} className="action-card">
          <h2>Creer une partie</h2>
          <label>
            Titre
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <button type="submit" disabled={actionLoading}>
            {actionLoading ? "..." : "Creer"}
          </button>
        </form>

        <form onSubmit={handleJoin} className="action-card">
          <h2>Rejoindre une partie</h2>
          <label>
            Code
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              required
              minLength={4}
              maxLength={8}
            />
          </label>
          <button type="submit" disabled={actionLoading}>
            {actionLoading ? "..." : "Rejoindre"}
          </button>
        </form>
      </section>

      {actionError && <p className="error">{actionError}</p>}

      {session.campaigns.length > 0 && (
        <section className="campaign-list">
          <h2>Mes parties</h2>
          <ul>
            {session.campaigns.map((item) => (
              <li key={item.memberId}>
                <button type="button" onClick={() => navigate(`/campaigns/${item.campaign.id}`)}>
                  <strong>{item.campaign.title}</strong>
                  <span>
                    {item.role} — {item.campaign.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
