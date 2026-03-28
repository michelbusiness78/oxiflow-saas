// Route de données protégée par auth.
// Retourne les données nécessaires à la génération PDF côté client.
// La génération PDF (jsPDF) se fait dans le navigateur pour éviter
// les dépendances canvas en environnement Node.js.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type'); // 'devis' | 'facture'
  const id   = searchParams.get('id');

  if (!type || !id || !['devis', 'facture'].includes(type)) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  // Tenant courant
  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  // Infos société
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, address, email, phone, siret, tva_intra')
    .eq('id', profile.tenant_id)
    .single();

  if (type === 'devis') {
    const { data: devis, error } = await supabase
      .from('devis')
      .select('*, clients(nom, adresse, cp, ville, email, tel)')
      .eq('id', id)
      .single();

    if (error || !devis) {
      return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
    }

    return NextResponse.json({
      type:        'devis',
      num:         devis.num,
      date:        devis.date,
      validite:    devis.validite,
      lignes:      devis.lignes,
      montant_ht:  devis.montant_ht,
      tva:         devis.tva,
      montant_ttc: devis.montant_ttc,
      client:      devis.clients,
      societe: {
        nom:       tenant?.name       ?? '',
        adresse:   tenant?.address    ?? '',
        email:     tenant?.email      ?? '',
        tel:       tenant?.phone      ?? '',
        siret:     tenant?.siret      ?? '',
        tva_intra: tenant?.tva_intra  ?? '',
      },
    });
  }

  // Facture
  const { data: facture, error } = await supabase
    .from('factures')
    .select('*, clients(nom, adresse, cp, ville, email, tel)')
    .eq('id', id)
    .single();

  if (error || !facture) {
    return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
  }

  return NextResponse.json({
    type:        'facture',
    num:         facture.num,
    date:        facture.date,
    echeance:    facture.echeance,
    lignes:      facture.lignes,
    montant_ht:  facture.montant_ht,
    tva:         facture.tva,
    montant_ttc: facture.montant_ttc,
    client:      facture.clients,
    societe: {
      nom:       tenant?.name       ?? '',
      adresse:   tenant?.address    ?? '',
      email:     tenant?.email      ?? '',
      tel:       tenant?.phone      ?? '',
      siret:     tenant?.siret      ?? '',
      tva_intra: tenant?.tva_intra  ?? '',
    },
    mentions: 'En cas de retard de paiement, une pénalité de 3 fois le taux d\'intérêt légal sera appliquée. Indemnité forfaitaire pour frais de recouvrement : 40€.',
  });
}
