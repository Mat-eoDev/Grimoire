import { Link } from "react-router-dom";

// Mentions legales (loi LCEN) : identite de l'editeur du site et de l'hebergeur.
// Distinct de la politique de confidentialite (RGPD) : voir /confidentialite.
export function LegalPage() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "680px", textAlign: "left" }}>
        <p className="auth-brand">GRIMOIRE</p>
        <h1 className="auth-title" style={{ marginBottom: "0.5rem" }}>
          Mentions légales
        </h1>
        <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1.5rem" }}>
          Dernière mise à jour : 7 juillet 2026
        </p>

        <div style={{ fontSize: "0.95rem", lineHeight: 1.65 }}>
          <h2 style={sectionTitle}>Éditeur du site</h2>
          <p>
            Le site Grimoire est édité par Mateo H., dans le cadre d'un projet personnel /
            de formation. Contact :{" "}
            <a href="mailto:mateo.hennebelle@gmail.com" className="auth-link">
              mateo.hennebelle@gmail.com
            </a>
            .
          </p>

          <h2 style={sectionTitle}>Directeur de la publication</h2>
          <p>Mateo H.</p>

          <h2 style={sectionTitle}>Hébergement</h2>
          <p>
            L'application est hébergée par <strong>Render</strong> (Render Services, Inc.),
            525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis —{" "}
            <a href="https://render.com" className="auth-link" target="_blank" rel="noreferrer">
              render.com
            </a>
            . La base de données est hébergée par <strong>Neon</strong> (
            <a href="https://neon.tech" className="auth-link" target="_blank" rel="noreferrer">
              neon.tech
            </a>
            ), au sein de l'Union européenne (région Francfort).
          </p>

          <h2 style={sectionTitle}>Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (code, interface, textes) est la propriété de
            l'éditeur, sauf mention contraire. Toute reproduction non autorisée est interdite.
          </p>

          <h2 style={sectionTitle}>Données personnelles</h2>
          <p>
            Le traitement de vos données personnelles est décrit dans notre{" "}
            <Link className="auth-link" to="/confidentialite">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>

        <p style={{ marginTop: "1.75rem" }}>
          <Link className="auth-link" to="/">
            ← Retour à l'accueil
          </Link>
        </p>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "1.05rem",
  marginTop: "1.5rem",
  marginBottom: "0.4rem"
};
