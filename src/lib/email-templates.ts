// ─── Helpers ──────────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.oxiflow.fr';

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OxiFlow</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1B2A4A;padding:24px 32px;">
              <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">
                Oxi<span style="color:#60A5FA;">Flow</span>
              </span>
              <span style="font-size:11px;color:#94A3B8;margin-left:10px;font-weight:400;">
                Gestion PME avec IA
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1B2A4A;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#94A3B8;">
                &copy; 2026 OxiFlow &mdash; Gestion PME avec IA
              </p>
              <a href="${SITE_URL}/desinscription"
                style="font-size:11px;color:#64748B;text-decoration:underline;">
                Se d&eacute;sinscrire des emails
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
    <tr>
      <td style="border-radius:8px;background:#2563EB;">
        <a href="${url}"
          style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;
                 color:#FFFFFF;text-decoration:none;border-radius:8px;
                 background:#2563EB;letter-spacing:0.1px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1B2A4A;line-height:1.3;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0;" />`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function welcomeEmail(
  userName: string,
  trialEndDate: Date,
): { subject: string; html: string } {
  const formattedDate = trialEndDate.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = base(`
    ${h1(`Bienvenue sur OxiFlow, ${userName}\u00a0!`)}
    ${p("Votre compte est pr\u00eat. Vous b\u00e9n\u00e9ficiez d\u2019un <strong>essai gratuit de 14\u00a0jours</strong>, sans carte bancaire requise.")}
    ${p(`Votre essai se termine le <strong>${formattedDate}</strong>. Profitez de toutes les fonctionnalit\u00e9s sans restriction pendant cette p\u00e9riode.`)}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="background:#F8FAFC;border-radius:8px;padding:0;margin:20px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:0.5px;">
            Ce que vous pouvez faire d\u00e8s maintenant
          </p>
          <ul style="margin:0;padding-left:18px;">
            <li style="font-size:14px;color:#334155;margin-bottom:6px;line-height:1.5;">G\u00e9rer vos devis et factures</li>
            <li style="font-size:14px;color:#334155;margin-bottom:6px;line-height:1.5;">Suivre vos indicateurs de pilotage</li>
            <li style="font-size:14px;color:#334155;margin-bottom:6px;line-height:1.5;">Inviter votre \u00e9quipe</li>
            <li style="font-size:14px;color:#334155;line-height:1.5;">Utiliser l\u2019assistant vocal IA</li>
          </ul>
        </td>
      </tr>
    </table>

    ${ctaButton("Acc\u00e9der \u00e0 mon espace", `${SITE_URL}/pilotage`)}
    ${divider()}
    ${p("<small style=\"color:#64748B;\">Une question\u00a0? R\u00e9pondez directement \u00e0 cet email, notre \u00e9quipe vous r\u00e9pond sous 24h.</small>")}
  `);

  return {
    subject: `Bienvenue sur OxiFlow, ${userName} \u2014 votre essai commence maintenant`,
    html,
  };
}

export function trialEndingEmail(
  userName: string,
  daysLeft: number,
): { subject: string; html: string } {
  const daysText = daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`;
  const urgencyColor = daysLeft <= 1 ? '#DC2626' : '#D97706';
  const daysLabel = daysLeft === 1 ? '1 jour' : `${daysLeft} jours`;

  const html = base(`
    ${h1(`${userName}, votre essai se termine ${daysText}`)}
    ${p("Vous avez utilis\u00e9 OxiFlow pendant votre p\u00e9riode d\u2019essai. Pour continuer \u00e0 acc\u00e9der \u00e0 toutes vos donn\u00e9es et fonctionnalit\u00e9s, choisissez un plan adapt\u00e9 \u00e0 votre activit\u00e9.")}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="border:2px solid ${urgencyColor};border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:${urgencyColor};font-weight:700;">
            &#9203; Il vous reste ${daysLabel} avant la fin de votre essai gratuit.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="background:#F8FAFC;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:0.5px;">
            Nos plans
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #E2E8F0;">
                <span style="font-size:14px;color:#334155;font-weight:600;">Solo</span>
                <span style="font-size:14px;color:#64748B;"> &mdash; 29&euro;/mois &middot; 1 utilisateur</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #E2E8F0;">
                <span style="font-size:14px;color:#334155;font-weight:600;">Team</span>
                <span style="font-size:14px;color:#64748B;"> &mdash; 59&euro;/mois &middot; 5 utilisateurs</span>
                <span style="font-size:11px;background:#2563EB;color:#fff;padding:2px 7px;border-radius:10px;margin-left:6px;font-weight:700;">Populaire</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <span style="font-size:14px;color:#334155;font-weight:600;">Pro</span>
                <span style="font-size:14px;color:#64748B;"> &mdash; 99&euro;/mois &middot; 15 utilisateurs</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${ctaButton("Choisir mon plan", `${SITE_URL}/pilotage/abonnement`)}
    ${divider()}
    ${p("<small style=\"color:#64748B;\">Sans engagement &mdash; annulation \u00e0 tout moment depuis votre espace.</small>")}
  `);

  return {
    subject: `Votre essai OxiFlow se termine ${daysText} \u2014 choisissez votre plan`,
    html,
  };
}

export function invoiceEmail(
  userName: string,
  invoiceUrl: string,
): { subject: string; html: string } {
  const now = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = base(`
    ${h1("Votre facture est disponible")}
    ${p(`Bonjour ${userName},`)}
    ${p(`Votre facture OxiFlow du <strong>${now}</strong> est disponible. Vous pouvez la t\u00e9l\u00e9charger en cliquant sur le bouton ci-dessous.`)}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#0369A1;">
            &#128196; La facture est h\u00e9berg\u00e9e sur Stripe, notre partenaire de paiement s\u00e9curis\u00e9.
          </p>
        </td>
      </tr>
    </table>

    ${ctaButton("T\u00e9l\u00e9charger ma facture", invoiceUrl)}
    ${divider()}
    ${p("<small style=\"color:#64748B;\">Conservez cet email pour votre comptabilit\u00e9. La facture est \u00e9galement accessible depuis votre espace abonnement.</small>")}
  `);

  return {
    subject: 'Votre facture OxiFlow est disponible',
    html,
  };
}

export function passwordResetEmail(
  userName: string,
  resetUrl: string,
): { subject: string; html: string } {
  const html = base(`
    ${h1("R\u00e9initialisation de votre mot de passe")}
    ${p(`Bonjour ${userName},`)}
    ${p("Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe OxiFlow. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.")}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">
            &#9203; Ce lien expire dans <strong>1 heure</strong>. Pass\u00e9 ce d\u00e9lai, vous devrez faire une nouvelle demande.
          </p>
        </td>
      </tr>
    </table>

    ${ctaButton("R\u00e9initialiser mon mot de passe", resetUrl)}
    ${divider()}
    ${p("<small style=\"color:#64748B;\">Si vous n\u2019avez pas demand\u00e9 cette r\u00e9initialisation, ignorez cet email &mdash; votre mot de passe reste inchang\u00e9.</small>")}
    ${p("<small style=\"color:#64748B;\">Pour votre s\u00e9curit\u00e9, ne transmettez jamais ce lien \u00e0 un tiers.</small>")}
  `);

  return {
    subject: "R\u00e9initialisation de votre mot de passe OxiFlow",
    html,
  };
}
