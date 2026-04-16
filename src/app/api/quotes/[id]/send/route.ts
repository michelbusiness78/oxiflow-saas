// Route API — envoi email devis avec PDF en pièce jointe.
// POST /api/quotes/[id]/send
//
// 1. Vérifie l'auth + le tenant
// 2. Récupère le devis, le client et la société (createAdminClient)
// 3. Génère le PDF serveur-side (buildDevisPdf)
// 4. Envoie l'email avec la PJ via Resend (sendEmailWithAttachment)
// 5. Met à jour le statut du devis → 'envoye'

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { buildDevisPdf }              from '@/lib/pdf/devis-pdf';
import { sendEmailWithAttachment }    from '@/lib/email';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });
  }

  const tenantId = profile.tenant_id as string;
  const { id }   = await params;

  // ── Devis ─────────────────────────────────────────────────────────────────
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select(`
      id, number, affair_number, objet, date, validity, statut,
      lignes, notes, conditions, deposit_percent,
      montant_ht, tva_amount, montant_ttc,
      client_id, company_id,
      clients(nom, adresse, cp, ville, email, tel)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  // ── Client email ──────────────────────────────────────────────────────────
  const client      = quote.clients as unknown as Record<string, unknown> | null;
  const clientEmail = client?.email as string | null;
  const clientNom   = client?.nom   as string | null;

  if (!clientEmail) {
    return NextResponse.json(
      { error: 'Aucune adresse email renseignée pour ce client.' },
      { status: 422 },
    );
  }

  // ── Société émettrice ──────────────────────────────────────────────────────
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

  // ── Génération PDF ─────────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    const arrayBuffer = await buildDevisPdf(quote, company);
    pdfBuffer = Buffer.from(arrayBuffer);
  } catch (pdfErr) {
    console.error('[send-devis] PDF generation error:', pdfErr);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }

  // ── Corps email ────────────────────────────────────────────────────────────
  const devisNumero = quote.number as string;
  const montantTtc  = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(quote.montant_ttc as number);
  const validite    = quote.validity
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(quote.validity as string))
    : null;
  const objetLine   = quote.objet ? `<br>Objet : <strong>${quote.objet as string}</strong>` : '';

  const contactBlock = [
    societeNom,
    societeEmail ? `<a href="mailto:${societeEmail}" style="color:#2563EB">${societeEmail}</a>` : null,
    societePhone,
  ].filter(Boolean).join(' · ');

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

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
              Bonjour${clientNom ? ` <strong>${clientNom}</strong>` : ''},
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
              Veuillez trouver ci-joint le devis <strong>${devisNumero}</strong>
              établi par <strong>${societeNom}</strong>.${objetLine}
            </p>

            <!-- Récapitulatif -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f1f5f9;border-radius:8px;padding:20px;margin-bottom:28px">
              <tr>
                <td style="font-size:13px;color:#64748b;padding:4px 0">Montant TTC</td>
                <td align="right" style="font-size:16px;font-weight:700;color:#1e3a8a">${montantTtc}</td>
              </tr>
              ${validite ? `
              <tr>
                <td style="font-size:13px;color:#64748b;padding:4px 0">Validité du devis</td>
                <td align="right" style="font-size:13px;color:#475569">${validite}</td>
              </tr>` : ''}
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.6;background:#eff6ff;border-left:3px solid #2563eb;padding:12px 16px;border-radius:0 6px 6px 0">
              📎 Vous trouverez le devis en pièce jointe au format PDF.
            </p>

            <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">
              N'hésitez pas à nous contacter pour toute question ou pour valider ce devis.
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

  // ── Envoi email ────────────────────────────────────────────────────────────
  try {
    await sendEmailWithAttachment(
      clientEmail,
      `Devis ${devisNumero}${quote.objet ? ` — ${quote.objet as string}` : ''} · ${societeNom}`,
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

  // ── Mise à jour statut ─────────────────────────────────────────────────────
  await admin
    .from('quotes')
    .update({
      statut:     'envoye',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return NextResponse.json({ success: true, email: clientEmail });
}
