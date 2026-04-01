import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // ── Auth (createClient uniquement pour getUser) ───────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // ── Profil (admin, bypass RLS) ────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  const tenantId = profile.tenant_id as string;

  const body = await request.json() as { tool: string; input: Record<string, unknown> };
  const { tool, input } = body;

  // ── consulter_kpis ────────────────────────────────────────────────────────
  if (tool === 'consulter_kpis') {
    const today = new Date().toISOString().split('T')[0];

    const [projRes, tachRes, invRes, savRes] = await Promise.all([
      admin
        .from('projects')
        .select('id, status')
        .eq('tenant_id', tenantId),
      admin
        .from('taches')
        .select('id, etat, date_echeance')
        .eq('tenant_id', tenantId),
      admin
        .from('invoices')
        .select('id, status, total_ttc')
        .eq('tenant_id', tenantId),
      admin
        .from('sav_tickets')
        .select('id, statut')
        .eq('tenant_id', tenantId),
    ]);

    const projets    = projRes.data  ?? [];
    const taches     = tachRes.data  ?? [];
    const invoices   = invRes.data   ?? [];
    const savTickets = savRes.data   ?? [];

    const result = {
      projets_en_cours:  projets.filter((p) => p.status === 'en_cours').length,
      projets_total:     projets.length,
      taches_en_retard:  taches.filter((t) => t.etat !== 'terminee' && t.date_echeance && t.date_echeance < today).length,
      taches_en_cours:   taches.filter((t) => t.etat === 'en_cours' || t.etat === 'en_review').length,
      factures_impayees: invoices.filter((f) => f.status === 'emise' || f.status === 'en_retard').length,
      ca_potentiel:      invoices.filter((f) => f.status !== 'payee').reduce((s, f) => s + Number(f.total_ttc ?? 0), 0),
      sav_ouverts:       savTickets.filter((s) => s.statut === 'ouvert' || s.statut === 'en_cours').length,
    };

    const msg =
      `${result.projets_en_cours} projet(s) en cours, ` +
      `${result.taches_en_retard} tâche(s) en retard, ` +
      `${result.factures_impayees} facture(s) impayée(s), ` +
      `${result.sav_ouverts} ticket(s) SAV ouvert(s). ` +
      `CA en attente : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(result.ca_potentiel)}.`;

    return NextResponse.json({ result: msg });
  }

  // ── rechercher_client ─────────────────────────────────────────────────────
  if (tool === 'rechercher_client') {
    const nom = String(input.nom ?? '').trim();
    if (!nom) return NextResponse.json({ result: 'Nom de recherche vide.' });

    const { data: clients } = await admin
      .from('clients')
      .select('id, nom, email, tel, ville')
      .eq('tenant_id', tenantId)
      .ilike('nom', `%${nom}%`)
      .limit(5);

    if (!clients || clients.length === 0) {
      return NextResponse.json({ result: `Aucun client trouvé pour "${nom}".` });
    }

    const list = clients
      .map((c) => `${c.nom}${c.ville ? ` (${c.ville})` : ''}${c.tel ? ` — ${c.tel}` : ''}`)
      .join(' ; ');

    return NextResponse.json({ result: `${clients.length} client(s) trouvé(s) : ${list}.` });
  }

  // ── planifier_tache ───────────────────────────────────────────────────────
  if (tool === 'planifier_tache') {
    const titre         = String(input.titre ?? '').trim();
    const assigne_nom   = input.assigne_nom   ? String(input.assigne_nom).trim()   : null;
    const date_echeance = input.date_echeance ? String(input.date_echeance).trim() : null;
    const priorite      = (['faible', 'normale', 'haute', 'urgente'].includes(String(input.priorite)))
      ? String(input.priorite) : 'normale';

    if (!titre) return NextResponse.json({ result: 'Titre de tâche manquant.' });

    let assigne_a: string | null = null;
    if (assigne_nom) {
      const { data: found } = await admin
        .from('users')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${assigne_nom}%`)
        .limit(1)
        .single();
      if (found) assigne_a = found.id;
    }

    const { error } = await admin.from('taches').insert({
      tenant_id:      tenantId,
      projet_id:      null,
      titre,
      description:    null,
      assigne_a,
      priorite,
      etat:           'a_faire',
      date_echeance:  date_echeance || null,
      pct_avancement: 0,
    });

    if (error) return NextResponse.json({ result: `Erreur création tâche : ${error.message}` });

    const who  = assigne_nom   ? ` assignée à ${assigne_nom}` : '';
    const when = date_echeance ? ` pour le ${new Date(date_echeance).toLocaleDateString('fr-FR')}` : '';
    return NextResponse.json({ result: `Tâche "${titre}" créée${who}${when}.` });
  }

  return NextResponse.json({ error: 'Outil inconnu.' }, { status: 400 });
}
