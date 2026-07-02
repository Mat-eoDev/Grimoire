import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { apiFetch } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", json: { token, password } });
      setDone(true);
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">GRIMOIRE</p>
        <h1 className="auth-title">Nouveau mot de passe</h1>

        {!token ? (
          <p className="auth-error">
            Lien invalide : aucun jeton fourni. Refais une demande depuis « Mot de passe oublié ? ».
          </p>
        ) : done ? (
          <>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1rem" }}>
              Ton mot de passe a été réinitialisé 🔑 Tu peux te reconnecter. Redirection…
            </p>
            <Link className="auth-link" to="/">← Aller à la connexion</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Nouveau mot de passe</label>
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
            <div className="auth-field">
              <label className="auth-label">Confirme le mot de passe</label>
              <div className="auth-input-wrap">
                <span className="auth-icon">✦</span>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "..." : "Réinitialiser"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
