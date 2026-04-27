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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "En attente",
  ACTIVE: "En cours",
  CLOSED: "Terminée"
};

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
      if (mode === "register") payload.username = username;
      await apiFetch(path, { method: "POST", json: payload });
      await onSessionRefresh();
      setEmail(""); setUsername(""); setPassword("");
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

  /* ── PAGE AUTH ── */
  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-brand">GRIMOIRE</p>
          <h1 className="auth-title">
            {mode === "login" ? "Welcome back" : "Create your story"}
          </h1>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === "login" ? " auth-tab--active" : ""}`}
              onClick={() => { setMode("login"); setAuthError(null); }}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "register" ? " auth-tab--active" : ""}`}
              onClick={() => { setMode("register"); setAuthError(null); }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {mode === "register" && (
              <div className="auth-field">
                <label className="auth-label">Name</label>
                <div className="auth-input-wrap">
                  <span className="auth-icon auth-icon--name">N</span>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Ton pseudo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email</label>
              <div className="auth-input-wrap">
                <span className="auth-icon">@</span>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-icon">✦</span>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            {authError && <p className="auth-error">{authError}</p>}

            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading ? "..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? (
              <>New to Grimoire?{" "}
                <button type="button" className="auth-link" onClick={() => setMode("register")}>
                  Create an account
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" className="auth-link" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  /* ── PAGE ACCUEIL CONNECTÉ ── */
  return (
    <div className="app-shell">
      <header className="hero-band">
        <div>
          <p className="eyebrow">Grimoire</p>
          <h1>Bonjour, {session.user.username} 👋</h1>
        </div>
        <button type="button" className="button-ghost" onClick={onLogout}>
          Se déconnecter
        </button>
      </header>

      <div className="dashboard-grid" style={{ marginTop: "1.25rem" }}>
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Créer une partie</h2>
              <p>Lance une nouvelle campagne en tant que MJ</p>
            </div>
          </div>
          <div className="section-card__body">
            <form onSubmit={handleCreate} className="stack-form">
              <label>
                Titre de la campagne
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="La forêt maudite..."
                  required
                />
              </label>
              <button type="submit" disabled={actionLoading}>
                {actionLoading ? "..." : "Créer"}
              </button>
            </form>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Rejoindre une partie</h2>
              <p>Entre le code donné par ton MJ</p>
            </div>
          </div>
          <div className="section-card__body">
            <form onSubmit={handleJoin} className="stack-form">
              <label>
                Code de la partie
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="EX: AB12CD"
                  required
                  minLength={4}
                  maxLength={8}
                />
              </label>
              <button type="submit" disabled={actionLoading}>
                {actionLoading ? "..." : "Rejoindre"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {actionError && <p className="feedback feedback--error">{actionError}</p>}

      {session.campaigns.length > 0 && (
        <div className="section-card" style={{ marginTop: "1.25rem" }}>
          <div className="section-card__header">
            <h2>Mes parties ({session.campaigns.length})</h2>
          </div>
          <div className="section-card__body stack-layout">
            {session.campaigns.map((item) => (
              <button
                key={item.memberId}
                type="button"
                className="list-row"
                onClick={() => navigate(`/campaigns/${item.campaign.id}`)}
                style={{ width: "100%", textAlign: "left", borderRadius: "18px", background: "var(--paper-strong)", cursor: "pointer" }}
              >
                <div>
                  <strong>{item.campaign.title}</strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                    {item.role === "GM" ? "MJ" : "Joueur"}
                  </p>
                </div>
                <span className={`pill${item.campaign.status === "ACTIVE" ? " pill--success" : item.campaign.status === "CLOSED" ? "" : " pill--warning"}`}>
                  {STATUS_LABEL[item.campaign.status] ?? item.campaign.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
