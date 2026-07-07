import { Link } from "react-router-dom";

// Politique de confidentialité — page d'information RGPD.
// Le seul cookie de l'app (session d'authentification) est strictement necessaire :
// il est exempte de consentement, donc pas de banniere. Cette page couvre l'obligation
// de transparence du RGPD (quelles donnees, pourquoi, combien de temps, quels droits).
export function PrivacyPage() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "680px", textAlign: "left" }}>
        <p className="auth-brand">GRIMOIRE</p>
        <h1 className="auth-title" style={{ marginBottom: "0.5rem" }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1.5rem" }}>
          Dernière mise à jour : 7 juillet 2026
        </p>

        <div style={{ fontSize: "0.95rem", lineHeight: 1.65 }}>
          <p>
            Grimoire est un outil de gestion de parties de jeu de rôle. Cette page explique
            quelles données personnelles sont collectées, pourquoi, combien de temps elles
            sont conservées, et quels sont vos droits.
          </p>

          <h2 style={sectionTitle}>1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement est l'éditeur du projet Grimoire. Pour toute
            question relative à vos données, vous pouvez écrire à :{" "}
            <a href="mailto:mateo.hennebelle@gmail.com" className="auth-link">
              mateo.hennebelle@gmail.com
            </a>
            .
          </p>

          <h2 style={sectionTitle}>2. Données que nous collectons</h2>
          <ul style={list}>
            <li>
              <strong>Données de compte</strong> : votre adresse e-mail et votre pseudo.
            </li>
            <li>
              <strong>Mot de passe</strong> : il n'est <em>jamais</em> stocké en clair. Nous
              conservons uniquement une empreinte cryptographique (hachage scrypt avec sel),
              impossible à inverser.
            </li>
            <li>
              <strong>Données de jeu</strong> : les campagnes, fiches de personnage, notes,
              inventaires et échanges que vous créez en utilisant l'application.
            </li>
            <li>
              <strong>Donnée technique</strong> : un cookie de session (voir section 6).
            </li>
          </ul>

          <h2 style={sectionTitle}>3. Pourquoi (finalités)</h2>
          <ul style={list}>
            <li>Créer votre compte et vous authentifier.</li>
            <li>Faire fonctionner le jeu (parties en temps réel, personnages, inventaire).</li>
            <li>
              Vous envoyer les e-mails liés au service : message de bienvenue et
              réinitialisation de mot de passe.
            </li>
          </ul>
          <p>
            La base légale est l'exécution du service que vous demandez en créant un compte.
            Aucune donnée n'est utilisée à des fins publicitaires et rien n'est revendu.
          </p>

          <h2 style={sectionTitle}>4. Hébergement et sous-traitants</h2>
          <p>
            Vos données sont hébergées et traitées par des prestataires techniques, au sein
            de l'Union européenne lorsque c'est possible :
          </p>
          <ul style={list}>
            <li>
              <strong>Render</strong> — hébergement de l'application (région Francfort, UE).
            </li>
            <li>
              <strong>Neon</strong> — base de données PostgreSQL (région Francfort, UE).
            </li>
            <li>
              <strong>Brevo</strong> — envoi des e-mails transactionnels (bienvenue,
              réinitialisation de mot de passe).
            </li>
          </ul>

          <h2 style={sectionTitle}>5. Durée de conservation</h2>
          <ul style={list}>
            <li>
              <strong>Compte</strong> : conservé tant que le compte existe. Sa suppression
              entraîne l'effacement des données associées.
            </li>
            <li>
              <strong>Session</strong> : le cookie et la session expirent au bout de 7 jours.
            </li>
            <li>
              <strong>Lien de réinitialisation</strong> : valable 1 heure, puis supprimé.
            </li>
          </ul>

          <h2 style={sectionTitle}>6. Cookies</h2>
          <p>
            Grimoire utilise <strong>un seul cookie</strong>, nommé{" "}
            <code>newmj_session</code>. Il est <strong>strictement nécessaire</strong> : il
            sert uniquement à vous garder connecté. À ce titre, il est exempté de
            consentement et aucune bannière n'est requise. Il est <code>HttpOnly</code>{" "}
            (inaccessible au JavaScript), <code>Secure</code> (transmis en HTTPS uniquement)
            et <code>SameSite=Lax</code> (protection contre le CSRF).
          </p>
          <p>
            Nous n'utilisons <strong>aucun</strong> cookie de mesure d'audience, de publicité
            ou de traçage tiers.
          </p>

          <h2 style={sectionTitle}>7. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification,
            d'effacement et d'opposition sur vos données. Pour exercer ces droits, contactez
            l'adresse indiquée en section 1. Vous pouvez également introduire une réclamation
            auprès de la CNIL (
            <a href="https://www.cnil.fr" className="auth-link" target="_blank" rel="noreferrer">
              cnil.fr
            </a>
            ).
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

const list: React.CSSProperties = {
  margin: "0.4rem 0 0.4rem 0",
  paddingLeft: "1.25rem"
};
