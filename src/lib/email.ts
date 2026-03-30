import { Resend } from 'resend';

// ─── Client Resend (singleton lazy) ──────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY manquant');
    _resend = new Resend(key);
  }
  return _resend;
}

// ─── Expéditeur par défaut ────────────────────────────────────────────────────

const FROM = 'OxiFlow <noreply@oxiflow.fr>';

// ─── Fonction générique ───────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
}
