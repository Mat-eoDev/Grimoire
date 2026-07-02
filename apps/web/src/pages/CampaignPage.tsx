import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { CharacterSelect, type CharacterChoice } from "../components/CharacterSelect";
import { CharacterSheet } from "../components/CharacterSheet";
import { TradePanel } from "../components/TradePanel";
import { LiveCampaign } from "../components/LiveCampaign";
import { apiFetch } from "../lib/api";
import type { CampaignDetail, SessionPayload } from "../lib/types";

type Props = {
  session: SessionPayload | null;
  onLogout: () => Promise<void>;
};

const MODE_LABEL: Record<string, string> = {
  DRAFT:  "Lobby",
  ACTIVE: "En cours",
  CLOSED: "Terminé"
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:  "En attente",
  ACTIVE: "En cours",
  CLOSED: "Terminée"
};

const AVATAR_COLORS = ["#c97a43","#6b8f6b","#6b7faf","#af6b8f","#8faf6b"];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export function CampaignPage({ session, onLogout }: Props) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [data, setData]               = useState<CampaignDetail | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [readyLoading, setReadyLoading]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [refreshKey, setRefreshKey]   = useState(0);

  const [character, setCharacter] = useState<CharacterChoice | null>(() => {
    if (!campaignId) return null;
    try {
      const stored = localStorage.getItem(`char_${campaignId}`);
      return stored ? (JSON.parse(stored) as CharacterChoice) : null;
    } catch { return null; }
  });

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      const result = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}`);
      setData(result);
      setError(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data || data.campaign.status === "CLOSED") return;
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
    } finally { setActionLoading(false); }
  }

  async function handleToggleReady() {
    if (!campaignId) return;
    setReadyLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/ready`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally { setReadyLoading(false); }
  }

  async function handleStop() {
    if (!campaignId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/campaigns/${campaignId}/stop`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally { setActionLoading(false); }
  }

  function handleCopy() {
    if (!data) return;
    navigator.clipboard.writeText(data.campaign.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleInvite() {
    if (!data) return;
    const url = `${window.location.origin}/?code=${data.campaign.joinCode}`;
    const text = `Rejoins ma campagne "${data.campaign.title}" sur Grimoire ! Code : ${data.campaign.joinCode}`;

    // Partage natif (Messages, Teams, Mail…) si disponible.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Invitation Grimoire", text, url });
        return;
      } catch (err) {
        // L'utilisateur a annulé le partage : on ne fait rien de plus.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Repli : copie du lien dans le presse-papier.
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setInviteFeedback("Lien d'invitation copié ✓");
    } catch {
      setInviteFeedback(url);
    }
    setTimeout(() => setInviteFeedback(null), 4000);
  }

  function handleCharacterConfirm(choice: CharacterChoice) {
    if (campaignId) localStorage.setItem(`char_${campaignId}`, JSON.stringify(choice));
    setCharacter(choice);
  }

  if (loading) return <div className="app-shell">Chargement...</div>;

  if (error || !data) {
    return (
      <div className="app-shell">
        <p className="feedback feedback--error">{error ?? "Partie introuvable"}</p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  const isGm = data.viewer.role === "GM";
  const { campaign } = data;
  const MAX_PLAYERS = 5;

  if (!isGm && !character) {
    return <CharacterSelect campaignId={campaignId!} onConfirm={handleCharacterConfirm} />;
  }

  const players = data.members.filter((m) => m.role === "PLAYER");
  const allPlayersReady = players.length > 0 && players.every((m) => m.isReady);
  const viewerMember = data.members.find((m) => m.id === data.viewer.memberId);
  const viewerIsReady = viewerMember?.isReady ?? false;

  /* checklist DRAFT */
  const checks = [
    { label: "Code partagé aux joueurs", done: true },
    { label: "MJ connecté",              done: true },
    { label: "Tous les joueurs prêts",   done: allPlayersReady },
  ];
  const progress = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

  if (campaign.status === "ACTIVE") {
    return <LiveCampaign data={data} onReload={load} onStop={handleStop} refreshKey={refreshKey} />;
  }

  return (
    <div className="app-shell">

      {/* ── Hero ── */}
      <header className="camp-hero">
        <div className="camp-hero__left">
          <Link to="/" className="camp-hero__back">← Accueil</Link>
          <h1 className="camp-hero__title">{campaign.title}</h1>
          <p className="camp-hero__meta">
            MJ: {campaign.gmUser.username}&nbsp;&nbsp;|&nbsp;&nbsp;Statut: {STATUS_LABEL[campaign.status]}
          </p>
          {session && (
            <button type="button" className="camp-hero__logout" onClick={onLogout}>
              Déconnexion ({session.user.username})
            </button>
          )}
        </div>
        <div className="camp-hero__stats">
          <div className="camp-hero__stat">
            <span className="camp-hero__stat-val">{campaign.joinCode}</span>
            <span className="camp-hero__stat-label">code partie</span>
            <span className="camp-hero__stat-bar camp-hero__stat-bar--orange" />
          </div>
          <div className="camp-hero__stat">
            <span className="camp-hero__stat-val">{data.members.length} / {MAX_PLAYERS}</span>
            <span className="camp-hero__stat-label">participants</span>
            <span className="camp-hero__stat-bar camp-hero__stat-bar--green" />
          </div>
          <div className="camp-hero__stat">
            <span className="camp-hero__stat-val">{MODE_LABEL[campaign.status]}</span>
            <span className="camp-hero__stat-label">mode</span>
            <span className="camp-hero__stat-bar camp-hero__stat-bar--orange" />
          </div>
        </div>
      </header>

      {/* ── Ligne 1 : Code + Participants ── */}
      <div className="dashboard-grid">

        {/* Code */}
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Code de la partie</h2>
              <p>Partage ce code aux joueurs pour qu'ils rejoignent ton aventure.</p>
            </div>
          </div>
          <div className="section-card__body" style={{ display: "grid", gap: "1rem" }}>
            <div className="code-display">
              <span className="code-display__value">{campaign.joinCode}</span>
              <button type="button" className="code-display__copy button-ghost" onClick={handleCopy}>
                {copied ? "Copié ✓" : "Copier"}
              </button>
            </div>

            {isGm && campaign.status === "DRAFT" && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="camp-btn-launch"
                  onClick={handleLaunch}
                  disabled={actionLoading || !allPlayersReady}
                  title={!allPlayersReady ? "En attente que tous les joueurs soient prêts" : undefined}
                >
                  {actionLoading ? "..." : "Lancer la campagne"}
                </button>
                {!allPlayersReady && (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-soft)", maxWidth: "22ch" }}>
                    {players.length === 0
                      ? "Aucun joueur dans le salon."
                      : `${players.filter((m) => m.isReady).length} / ${players.length} joueur${players.length > 1 ? "s" : ""} prêt${players.filter((m) => m.isReady).length > 1 ? "s" : ""}.`}
                  </p>
                )}
              </div>
            )}
            {!isGm && campaign.status === "DRAFT" && (
              <button
                type="button"
                className={`camp-btn-launch${viewerIsReady ? " camp-btn-launch--ready" : ""}`}
                onClick={handleToggleReady}
                disabled={readyLoading}
              >
                {readyLoading ? "..." : viewerIsReady ? "✓ Prêt" : "Je suis prêt"}
              </button>
            )}
            {campaign.status === "CLOSED" && (
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>Cette campagne est terminée.</p>
            )}
            {!isGm && character && campaign.status !== "CLOSED" && (
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)" }}>
                Personnage {character.charId} — <strong>{character.name}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Participants ({data.members.length})</h2>
              <p>Qui est dans le salon avant le départ</p>
            </div>
          </div>
          <div className="section-card__body" style={{ display: "grid", gap: "0.6rem" }}>
            {data.members.map((member) => {
              const color = avatarColor(member.user.username);
              const isThisMemberGm = member.role === "GM";
              return (
                <div key={member.id} className="participant-row">
                  <span className="participant-row__avatar" style={{ background: color }}>
                    {isThisMemberGm ? "👑" : member.user.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="participant-row__info">
                    <strong>{member.user.username}</strong>
                    <span>{isThisMemberGm ? "MJ de la partie" : "Joueur"}</span>
                  </span>
                  <span className={`pill${isThisMemberGm || member.isReady ? " pill--success" : ""}`}>
                    {isThisMemberGm ? "Connecté" : member.isReady ? "Prêt" : "En attente"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Ligne 2 : Préparation + Actions MJ ── */}
      {campaign.status === "DRAFT" && (
        <div className="dashboard-grid" style={{ marginTop: "1.25rem" }}>

          {/* Checklist */}
          <div className="section-card">
            <div className="section-card__header">
              <div>
                <h2>Préparation de la campagne</h2>
                <p>Un aperçu clair de ce qu'il reste à faire avant de lancer {campaign.title}.</p>
              </div>
            </div>
            <div className="section-card__body" style={{ display: "grid", gap: "1.25rem" }}>
              <div style={{ display: "grid", gap: "0.7rem" }}>
                {checks.map((c) => (
                  <label key={c.label} className="prep-check">
                    <span className={`prep-check__box${c.done ? " prep-check__box--done" : ""}`}>
                      {c.done && "✓"}
                    </span>
                    <span style={{ color: c.done ? "var(--ink)" : "var(--ink-soft)" }}>{c.label}</span>
                  </label>
                ))}
              </div>
              <div className="prep-progress">
                <p className="prep-progress__label">Prêt à {progress}%</p>
                <div className="prep-progress__bar">
                  <div className="prep-progress__fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions MJ */}
          <div className="camp-actions-mj">
            <p className="eyebrow">Actions MJ</p>
            <h2 className="camp-actions-mj__title">Garde le contrôle du salon</h2>
            <p className="camp-actions-mj__sub">
              Invite les derniers joueurs, vérifie le statut et lance la campagne au bon moment.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "auto" }}>
              <button type="button" className="camp-actions-mj__btn" onClick={handleInvite}>Inviter des joueurs</button>
            </div>
            {inviteFeedback && (
              <p className="camp-actions-mj__sub" style={{ marginTop: "0.6rem", wordBreak: "break-all" }}>{inviteFeedback}</p>
            )}
          </div>

        </div>
      )}

      {/* Fiche + Notes joueur */}
      {!isGm && campaignId && (
        <>
          <div style={{ marginTop: "1.25rem" }}>
            <CharacterSheet campaignId={campaignId} />
          </div>
          <TradePanel
            campaignId={campaignId}
            currentUserId={session?.user.id ?? ""}
            members={data.members}
          />
        </>
      )}

    </div>
  );
}
