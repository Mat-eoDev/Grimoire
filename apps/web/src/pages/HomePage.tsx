import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import type { CampaignSummaryResponse, SessionPayload } from "../lib/types";

type Props = {
  session: SessionPayload | null;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
};

type AuthMode = "login" | "register" | "forgot";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "En attente",
  ACTIVE: "En cours",
  CLOSED: "Terminée"
};

export function HomePage({ session, onSessionRefresh, onLogout }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [title, setTitle] = useState("");
  const [joinCode, setJoinCode] = useState(() => (searchParams.get("code") ?? "").toUpperCase());
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

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", json: { email } });
      setForgotSent(true);
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
            {mode === "login" ? "Welcome back" : mode === "register" ? "Create your story" : "Clés perdues ?"}
          </h1>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === "login" ? " auth-tab--active" : ""}`}
              onClick={() => { setMode("login"); setAuthError(null); setForgotSent(false); }}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "register" ? " auth-tab--active" : ""}`}
              onClick={() => { setMode("register"); setAuthError(null); setForgotSent(false); }}
            >
              Sign up
            </button>
          </div>

          {mode === "forgot" ? (
            forgotSent ? (
              <div className="auth-form">
                <p style={{ fontSize: "0.92rem", lineHeight: 1.6, marginBottom: "1rem", opacity: 0.85 }}>
                  Si un compte existe pour cette adresse, un email contenant un lien de récupération vient d'être envoyé.
                  Pense à vérifier tes spams. Le lien est valable 1 heure.
                </p>
                <button type="button" className="auth-link" onClick={() => { setMode("login"); setForgotSent(false); }}>
                  ← Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="auth-form">
                <p style={{ fontSize: "0.92rem", lineHeight: 1.6, marginBottom: "1rem", opacity: 0.85 }}>
                  Entre ton adresse email : on t'enverra un lien pour forger un nouveau mot de passe.
                </p>
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
                {authError && <p className="auth-error">{authError}</p>}
                <button type="submit" className="auth-submit" disabled={authLoading}>
                  {authLoading ? "..." : "Envoyer le lien"}
                </button>
                <button
                  type="button"
                  className="auth-link"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => { setMode("login"); setAuthError(null); }}
                >
                  ← Retour à la connexion
                </button>
              </form>
            )
          ) : (
          <>
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
          {mode === "login" && (
            <p className="auth-switch">
              <button
                type="button"
                className="auth-link"
                onClick={() => { setMode("forgot"); setAuthError(null); setForgotSent(false); }}
              >
                Mot de passe oublié ?
              </button>
            </p>
          )}
          </>
          )}
        </div>
      </div>
    );
  }

  /* ── PAGE ACCUEIL CONNECTÉ ── */
  const totalParties   = session.campaigns.length;
  const gmCount        = session.campaigns.filter(c => c.role === "GM").length;
  const codesActifs    = session.campaigns.filter(c => c.campaign.status !== "CLOSED").length;

  return (
    <div className="app-shell">

      {/* Hero */}
      <header className="home-hero">
        <div className="home-hero__left">
          <p className="eyebrow">Grimoire</p>
          <h1 className="home-hero__title">Bonjour, {session.user.username}</h1>
          <p className="home-hero__sub">
            Ton salon de campagne est prêt. Crée une campagne, rejoins une aventure ou reprends une partie en cours.
          </p>
        </div>
        <div className="home-hero__right">
          <button type="button" className="home-hero__logout" onClick={onLogout}>
            Se déconnecter
          </button>
          <div className="home-stats">
            <div className="home-stat">
              <span className="home-stat__num">{totalParties}</span>
              <span className="home-stat__label">parties</span>
            </div>
            <div className="home-stat">
              <span className="home-stat__num">{gmCount}</span>
              <span className="home-stat__label">en tant que MJ</span>
            </div>
            <div className="home-stat">
              <span className="home-stat__num">{codesActifs}</span>
              <span className="home-stat__label">codes actifs</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cartes action */}
      <div className="dashboard-grid">
        {/* Créer */}
        <div className="action-card">
          <div className="action-card__top">
            <div>
              <h2 className="action-card__title">Créer une partie</h2>
              <p className="action-card__sub">Lance une nouvelle campagne en tant que MJ</p>
            </div>
            <span className="action-card__icon action-card__icon--accent">+</span>
          </div>
          <div className="action-card__divider" />
          <form onSubmit={handleCreate} className="action-card__form">
            <label className="action-card__label">Titre de la campagne</label>
            <div className="auth-input-wrap">
              <span className="auth-icon auth-icon--name">T</span>
              <input
                className="auth-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="La forêt maudite..."
                required
              />
            </div>
            <button type="submit" className="action-card__btn" disabled={actionLoading}>
              {actionLoading ? "..." : "Créer"}
            </button>
          </form>
        </div>

        {/* Rejoindre */}
        <div className="action-card">
          <div className="action-card__top">
            <div>
              <h2 className="action-card__title">Rejoindre une partie</h2>
              <p className="action-card__sub">Entre le code donné par ton MJ</p>
            </div>
            <span className="action-card__icon action-card__icon--ghost">&gt;</span>
          </div>
          <div className="action-card__divider" />
          <form onSubmit={handleJoin} className="action-card__form">
            <label className="action-card__label">Code de la partie</label>
            <div className="auth-input-wrap">
              <span className="auth-icon">#</span>
              <input
                className="auth-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="EX: AB12CD"
                required
                minLength={4}
                maxLength={8}
              />
            </div>
            <button type="submit" className="action-card__btn" disabled={actionLoading}>
              {actionLoading ? "..." : "Rejoindre"}
            </button>
          </form>
        </div>
      </div>

      {actionError && <p className="feedback feedback--error">{actionError}</p>}

      {/* Liste des parties */}
      {session.campaigns.length > 0 && (
        <div className="section-card" style={{ marginTop: "1.25rem" }}>
          <div className="section-card__header">
            <h2>Mes parties ({session.campaigns.length})</h2>
            <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)", fontWeight: 600 }}>
              Dernière activité aujourd'hui
            </span>
          </div>
          <div className="section-card__body stack-layout">
            {session.campaigns.map((item) => {
              const letter = item.campaign.title.charAt(0).toUpperCase();
              const colors = ["#c97a43","#6b8f6b","#6b7faf","#af6b8f","#8faf6b"];
              const color  = colors[(item.campaign.title.charCodeAt(0) ?? 0) % colors.length];
              return (
                <button
                  key={item.memberId}
                  type="button"
                  className="campaign-row"
                  style={{ "--row-color": color } as React.CSSProperties}
                  onClick={() => navigate(`/campaigns/${item.campaign.id}`)}
                >
                  <span className="campaign-row__avatar">{letter}</span>
                  <span className="campaign-row__info">
                    <strong>{item.campaign.title}</strong>
                    <span>{item.role === "GM" ? "MJ" : "Joueur"}</span>
                  </span>
                  <span className={`pill${
                    item.campaign.status === "ACTIVE"  ? " pill--success" :
                    item.campaign.status === "CLOSED"  ? "" :
                    " pill--warning"
                  }`}>
                    {STATUS_LABEL[item.campaign.status] ?? item.campaign.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
