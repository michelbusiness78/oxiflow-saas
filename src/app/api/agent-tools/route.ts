import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/format';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  const body = await request.json() as { tool: string; input: Record<string, unknown> };
  const { tool, input } = body;

  // ── consulter_kpis ────────────────────────────────────────────────────────
  if (tool === 'consulter_kpis') {
    const [projRes, tachRes, facRes, savRes] = await Promise.all([
      supabase.from('projets').select('id, statut', { count: 'exact', head: false }),
      supabase.from('taches').select('id, etat, date_echeance', { count: 'exact', head: false }),
      supabase.from('factures').select('id, statut, montant_ttc'),
      supabase.from('sav_tickets').select('id, statut'),
    ]);

    const projets    = projRes.data  ?? [];
    const taches     = tachRes.data  ?? [];
    const factures   = facRes.data   ?? [];
    const savTickets = savRes.data   ?? [];
    const today      = new Date().toISOString().split('T')[0];

    const result = {
      projets_en_cours:   projets.filter((p) => p.statut === 'en_cours').length,
      projets_total:      projets.length,
      taches_en_retard:   taches.filter((t) => t.etat !== 'terminee' && t.date_echeance && t.date_echeance < today).length,
      taches_en_cours:    taches.filter((t) => t.etat === 'en_cours' || t.etat === 'en_review').length,
      factures_impayees:  factures.filter((f) => f.statut === 'impayee').length,
      ca_potentiel:       factures.filter((f) => f.statut !== 'payee').reduce((s, f) => s + Number(f.montant_ttc ?? 0), 0),
      sav_ouverts:        savTickets.filter((s) => s.statut === 'ouvert' || s.statut === 'en_cours').length,
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

    const { data: clients } = await supabase
      .from('clients')
      .select('id, nom, email, tel, ville')
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
    const titre        = String(input.titre        ?? '').trim();
    const assigne_nom  = input.assigne_nom  ? String(input.assigne_nom).trim()  : null;
    const date_echeance = input.date_echeance ? String(input.date_echeance).trim() : null;
    const priorite     = (['faible','normale','haute','urgente'].includes(String(input.priorite)))
      ? String(input.priorite) : 'normale';

    if (!titre) return NextResponse.json({ result: 'Titre de tâche manquant.' });

    // Resolve assigne_a by name if provided
    let assigne_a: string | null = null;
    if (assigne_nom) {
      const { data: found } = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', `%${assigne_nom}%`)
        .limit(1)
        .single();
      if (found) assigne_a = found.id;
    }

    const { error } = await supabase.from('taches').insert({
      tenant_id:     profile.tenant_id,
      projet_id:     null,
      titre,
      description:   null,
      assigne_a,
      priorite,
      etat:          'a_faire',
      date_echeance: date_echeance || null,
      pct_avancement: 0,
    });

    if (error) return NextResponse.json({ result: `Erreur création tâche : ${error.message}` });

    const who = assigne_nom ? ` assignée à ${assigne_nom}` : '';
    const when = date_echeance ? ` pour le ${new Date(date_echeance).toLocaleDateString('fr-FR')}` : '';
    return NextResponse.json({ result: `Tâche "${titre}" créée${who}${when}.` });
  }

  return NextResponse.json({ error: 'Outil inconnu.' }, { status: 400 });
}
