import { env } from "../env.js";

type WelcomeArgs = {
  to: string;
  username: string;
};

/**
 * Envoie un email de bienvenue via l'API Brevo (HTTP, pas de SMTP).
 * Si les variables d'environnement ne sont pas configurees, l'envoi est
 * silencieusement ignore (utile en local / si l'email n'est pas branche).
 * Ne jette jamais : un echec d'email ne doit pas casser l'inscription.
 */
export async function sendWelcomeEmail({ to, username }: WelcomeArgs): Promise<void> {
  if (!env.brevoApiKey || !env.mailFrom) {
    return;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        sender: { email: env.mailFrom, name: env.mailFromName },
        to: [{ email: to, name: username }],
        subject: "Bienvenue dans le Grimoire ⚔️",
        htmlContent: welcomeHtml(username)
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Email de bienvenue non envoye (HTTP ${response.status}): ${detail}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de bienvenue:", error);
  }
}

function welcomeHtml(username: string): string {
  const appLink = env.appUrl || env.clientOrigin;
  const cta = appLink
    ? `<a href="${appLink}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c9922b;color:#1a1206;text-decoration:none;border-radius:10px;font-weight:700;letter-spacing:.02em;">Ouvrir mon Grimoire</a>`
    : "";

  return `
  <div style="margin:0;padding:0;background:#0f0b06;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0b06;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf7ee;border:1px solid #e4d7ba;border-radius:16px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#2a2115;">
            <tr>
              <td style="background:#1a1206;padding:28px 32px;text-align:center;">
                <div style="font-size:34px;line-height:1;">📜</div>
                <h1 style="margin:10px 0 0;color:#e9c877;font-size:26px;letter-spacing:.04em;">GRIMOIRE</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;font-size:22px;color:#3a2c17;">Bienvenue, ${escapeHtml(username)}.</h2>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#4a3c28;">
                  On raconte qu'a la lisiere des royaumes oublies dort un vieux grimoire relie de cuir,
                  dont les pages ne s'ouvrent qu'aux conteurs de legendes. Ce soir, il a reconnu ta main.
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#4a3c28;">
                  A partir de maintenant, tu peux rassembler ta table, dresser tes scenes, invoquer
                  ennemis et alliees, lancer les des et faire basculer le destin de tes heros.
                  Chaque campagne que tu ouvriras viendra s'inscrire dans ces pages.
                </p>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.7;color:#4a3c28;">
                  Que ton aventure commence. 🕯️
                </p>
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #e4d7ba;font-size:12px;color:#8a7a5c;text-align:center;">
                Tu recois ce message car un compte Grimoire vient d'etre cree avec cette adresse.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
