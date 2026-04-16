// Route API — envoi email devis avec PDF en pièce jointe.
// POST /api/quotes/[id]/send
//
// Body JSON attendu : { to: string; subject: string; message: string }
//
// 1. Vérifie l'auth + le tenant (récupère aussi le nom de l'utilisateur)
// 2. Lit le devis + la société (createAdminClient) pour générer le PDF
// 3. Génère le PDF serveur-side (buildDevisPdf)
// 4. Envoie l'email avec la PJ via Resend (to/subject/message depuis le body)
// 5. Append une entrée dans send_history + passe le statut → 'envoye'
// 6. revalidatePath('/commerce')

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath }             from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { buildDevisPdf }              from '@/lib/pdf/devis-pdf';
import { sendEmailWithAttachment }    from '@/lib/email';
import type { SendHistoryEntry }      from '@/app/actions/quotes';

// Utilitaire — convertit du texte brut en HTML sécurisé
function textToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Body ──────────────────────────────────────────────────────────────────────
  let body: { to?: string; subject?: string; message?: string } = {};
  try { body = await req.json(); } catch { /* body vide → on validera plus bas */ }

  const to      = (body.to      ?? '').trim();
  const subject = (body.subject ?? '').trim();
  const message = body.message ?? '';

  if (!to) {
    return NextResponse.json(
      { error: 'Adresse email destinataire manquante.' },
      { status: 422 },
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Récupère tenant_id ET name pour l'historique
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });
  }

  const tenantId   = profile.tenant_id as string;
  const sentByName = (profile.name as string) ?? '';
  const { id }     = await params;

  // ── Devis (avec send_history existant) ────────────────────────────────────────
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select(`
      id, number, affair_number, objet, date, validity, statut,
      lignes, notes, conditions, deposit_percent,
      montant_ht, tva_amount, montant_ttc,
      client_id, company_id, send_history,
      clients(nom, adresse, cp, ville, email, tel)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  // ── Société émettrice (nécessaire pour le PDF + footer email) ─────────────────
  let company: Record<string, unknown> | null = null;
  if (quote.company_id) {
    const { data } = await admin
      .from('companies')
      .select('name, address, postal_code, city, phone, email, siret, tva_number, logo_url, iban, bic, mention_tva, conditions_paiement_defaut, pied_facture')
      .eq('id', quote.company_id as string)
      .single();
    company = data as Record<string, unknown> | null;
  }

  const societeNom   = (company?.name  as string) ?? 'OxiFlow';
  const societeEmail = (company?.email as string) ?? '';
  const societePhone = (company?.phone as string) ?? '';

  // ── Génération PDF ─────────────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    const arrayBuffer = await buildDevisPdf(quote, company);
    pdfBuffer = Buffer.from(arrayBuffer);
  } catch (pdfErr) {
    console.error('[send-devis] PDF generation error:', pdfErr);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }

  // ── Corps email — message utilisateur dans l'enveloppe HTML ──────────────────
  const devisNumero    = quote.number as string;
  const effectiveSubject = subject || `Devis ${devisNumero} · ${societeNom}`;

  const contactBlock = [
    societeNom,
    societeEmail ? `<a href="mailto:${societeEmail}" style="color:#2563EB">${societeEmail}</a>` : null,
    societePhone,
  ].filter(Boolean).join(' · ');

  const messageHtml = textToHtml(message);

  const emailBodyHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px 40px">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">
              ${societeNom}
            </p>
            <p style="margin:6px 0 0;font-size:13px;color:#bfdbfe">Devis ${devisNumero}</p>
          </td>
        </tr>

        <!-- Message personnalisé -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7">
              ${messageHtml}
            </p>
          </td>
        </tr>

        <!-- Notice pièce jointe -->
        <tr>
          <td style="padding:0 40px 32px">
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;background:#eff6ff;border-left:3px solid #2563eb;padding:12px 16px;border-radius:0 6px 6px 0">
              📎 Vous trouverez le devis en pièce jointe au format PDF.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e2e8f0;padding:24px 40px;background:#f8fafc">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
              ${contactBlock}
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;text-align:center">
              Ce message a été envoyé automatiquement depuis OxiFlow.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  // ── Envoi email ────────────────────────────────────────────────────────────────
  try {
    await sendEmailWithAttachment(
      to,
      effectiveSubject,
      emailBodyHtml,
      {
        filename: `Devis-${devisNumero}.pdf`,
        content:  pdfBuffer,
      },
    );
  } catch (emailErr) {
    console.error('[send-devis] Resend error:', emailErr);
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de l\'email. Vérifiez la configuration Resend.' },
      { status: 500 },
    );
  }

  // ── Mise à jour statut + historique ───────────────────────────────────────────
  const newEntry: SendHistoryEntry = {
    sent_at: new Date().toISOString(),
    to,
    subject: effectiveSubject,
    sent_by: sentByName,
  };

  // send_history existant — le parser si besoin (Supabase retourne du JSON natif)
  const rawHistory = quote.send_history;
  const existingHistory: SendHistoryEntry[] = Array.isArray(rawHistory)
    ? (rawHistory as SendHistoryEntry[])
    : typeof rawHistory === 'string'
      ? (JSON.parse(rawHistory) as SendHistoryEntry[])
      : [];

  const updatedHistory = [...existingHistory, newEntry];

  await admin
    .from('quotes')
    .update({
      statut:       'envoye',
      send_history: updatedHistory,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  revalidatePath('/commerce');

  return NextResponse.json({ success: true, email: to });
}
