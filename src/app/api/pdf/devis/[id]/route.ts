// Route API — génération PDF devis (table quotes)
// Retourne un blob application/pdf directement téléchargeable / affichable.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { buildDevisPdf }     from '@/lib/pdf/devis-pdf';

export async function GET(
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
    .from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  const tenantId = profile.tenant_id as string;
  const { id }   = await params;

  // ── Data ──────────────────────────────────────────────────────────────────
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

  // Société émettrice
  let company: Record<string, unknown> | null = null;
  if (quote.company_id) {
    const { data } = await admin
      .from('companies')
      .select('name, address, postal_code, city, phone, email, siret, tva_number, logo_url, iban, bic, mention_tva, conditions_paiement_defaut, pied_facture')
      .eq('id', quote.company_id as string)
      .single();
    company = data as Record<string, unknown> | null;
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  const pdfBuf = await buildDevisPdf(quote, company);

  return new NextResponse(pdfBuf, {
    status:  200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="devis-${quote.number as string}.pdf"`,
    },
  });
}
