'use server';

import { createAdminClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeteoSociete {
  id:       string;
  nom:      string;
  color:    string;
  caMois:   number;
  objectif: number | null;
  pct:      number | null;
  meteo:    'green' | 'orange' | 'red' | 'unknown';
}

export interface PrioriteItem {
  type:        'facture' | 'devis';
  id:          string;
  titre:       string;
  echeance:    string | null;
  lien:        string;
  projetNom:   string | null;
  montant:     number | null;
  joursRetard: number;
}

export interface DirigeantDashboardData {
  userName: string;
  kpis: {
    caMoisNet:        number;
    caMoisPrecedent:  number;
    variationMois:    number | null;
    caAnnuel:         number;
    margeDevisPct:    number | null;
    enRetardFactures: number;
    enRetardTaches:   number;
  };
  meteoSocietes:  MeteoSociete[];
  meteoGlobal:    'green' | 'orange' | 'red' | 'unknown';
  caGlobalMois:   number;
  sav: {
    ouverts:  number;
    enCours:  number;
    clotures: number;
    hasTable: boolean;
  };
  apiUsage: {
    tokensUsed: number;
    tokenMax:   number;
  };
  priorites:             PrioriteItem[];
  contratsARenouveler:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9'];

function sum(rows: { total_ttc?: number | null }[]) {
  return rows.reduce((s, r) => s + (r.total_ttc ?? 0), 0);
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getDashboardDirigeant(
  tenantId: string,
  userId:   string,
): Promise<DirigeantDashboardData> {
  const admin = await createAdminClient();
  const now   = new Date();

  const todayISO       = now.toISOString().split('T')[0];
  const yearStart      = `${now.getFullYear()}-01-01`;
  const monthStart     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const fifteenAgo     = new Date(now.getTime() - 15 * 86_400_000).toISOString();

  const [
    userRes,
    clientsRes,
    facturesMoisRes,
    facturesPrevRes,
    facturesAnnuelRes,
    facturesRetardRes,
    quotesRelanceRes,
    taskRetardRes,
    contratsRes,
  ] = await Promise.all([
    admin.from('users').select('name').eq('id', userId).single(),

    admin.from('clients').select('id').eq('tenant_id', tenantId),

    admin.from('invoices').select('total_ttc')
      .eq('tenant_id', tenantId).eq('status', 'payee').gte('date_facture', monthStart),

    admin.from('invoices').select('total_ttc')
      .eq('tenant_id', tenantId).eq('status', 'payee')
      .gte('date_facture', prevMonthStart).lte('date_facture', prevMonthEnd),

    admin.from('invoices').select('total_ttc')
      .eq('tenant_id', tenantId).eq('status', 'payee').gte('date_facture', yearStart),

    admin.from('invoices').select('id, number, total_ttc, date_echeance')
      .eq('tenant_id', tenantId).eq('status', 'emise').lt('date_echeance', todayISO),

    admin.from('quotes').select('id, number, objet, montant_ttc, created_at, clients(nom)')
      .eq('tenant_id', tenantId).eq('statut', 'envoye')
      .lt('created_at', fifteenAgo).order('created_at', { ascending: false }).limit(5),

    admin.from('project_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('done', false)
      .not('due', 'is', null).lt('due', todayISO),

    // Contrats actifs arrivant à échéance dans 30 jours ou déjà expirés
    admin.from('contrats')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .not('date_fin', 'is', null)
      .lte('date_fin', new Date(now.getTime() + 30 * 86_400_000).toISOString().split('T')[0]),
  ]);

  const userName       = (userRes.data?.name as string | null) ?? '';
  const clientIds      = (clientsRes.data ?? []).map((c) => c.id as string);
  const facturesMois   = facturesMoisRes.data   ?? [];
  const facturesPrev   = facturesPrevRes.data   ?? [];
  const facturesAnnuel = facturesAnnuelRes.data ?? [];
  const facturesRetard = facturesRetardRes.data ?? [];
  const quotesRelance  = quotesRelanceRes.data  ?? [];
  const tachesEnRetard       = taskRetardRes.count  ?? 0;
  const contratsARenouveler  = contratsRes.count    ?? 0;

  const [savRes, companiesRes] = await Promise.allSettled([
    clientIds.length > 0
      ? admin.from('sav_tickets').select('statut').in('client_id', clientIds)
      : Promise.resolve({ data: [] as { statut: string }[] }),
    admin.from('companies').select('id, nom, color').eq('tenant_id', tenantId).order('nom'),
  ]);

  const savRaw    = savRes.status     === 'fulfilled' ? savRes.value.data             : null;
  const companies = companiesRes.status === 'fulfilled' ? (companiesRes.value.data ?? []) : [];

  // ── Calculs ──────────────────────────────────────────────────────────────────

  const caMoisNet       = sum(facturesMois);
  const caMoisPrecedent = sum(facturesPrev);
  const caAnnuel        = sum(facturesAnnuel);

  const variationMois = caMoisPrecedent > 0
    ? Math.round(((caMoisNet - caMoisPrecedent) / caMoisPrecedent) * 100)
    : null;

  const meteoGlobal: DirigeantDashboardData['meteoGlobal'] =
    caMoisPrecedent > 0
      ? caMoisNet >= caMoisPrecedent * 0.8 ? 'green'
        : caMoisNet >= caMoisPrecedent * 0.5 ? 'orange'
        : 'red'
      : 'unknown';

  const savHasTable = savRaw !== null;
  const savOuverts  = savRaw?.filter((t) => t.statut === 'ouvert').length   ?? 0;
  const savEnCours  = savRaw?.filter((t) => t.statut === 'en_cours').length ?? 0;
  const savClotures = savRaw?.filter((t) =>
    ['cloture', 'ferme', 'resolu', 'termine'].includes(t.statut ?? ''),
  ).length ?? 0;

  const meteoSocietes: MeteoSociete[] = companies.map((c, i) => ({
    id:       c.id    as string,
    nom:      c.nom   as string,
    color:    (c.color as string | null) ?? PALETTE[i % PALETTE.length],
    caMois:   i === 0 ? caMoisNet : 0,
    objectif: null,
    pct:      null,
    meteo:    i === 0 ? meteoGlobal : 'unknown',
  }));

  // ── Priorités ─────────────────────────────────────────────────────────────────

  const priorites: PrioriteItem[] = [];

  for (const f of facturesRetard.slice(0, 3)) {
    const echeance = f.date_echeance as string | null;
    const jours    = echeance
      ? Math.max(0, Math.floor((now.getTime() - new Date(echeance).getTime()) / 86_400_000))
      : 0;
    priorites.push({
      type: 'facture', id: f.id as string, titre: `Facture ${f.number ?? ''}`,
      echeance, lien: '/commerce?tab=factures', projetNom: null,
      montant: (f.total_ttc as number | null), joursRetard: jours,
    });
  }

  for (const q of quotesRelance) {
    const jours = Math.floor(
      (now.getTime() - new Date(q.created_at as string).getTime()) / 86_400_000,
    );
    const clientNom = (q.clients as unknown as { nom: string } | null)?.nom ?? '—';
    priorites.push({
      type: 'devis', id: q.id as string,
      titre: `Devis ${q.number as string} — ${clientNom}`,
      echeance: null, lien: '/commerce?tab=devis', projetNom: null,
      montant: (q.montant_ttc as number | null), joursRetard: jours,
    });
  }

  priorites.sort((a, b) => b.joursRetard - a.joursRetard);

  return {
    userName,
    kpis: {
      caMoisNet,
      caMoisPrecedent,
      variationMois,
      caAnnuel,
      margeDevisPct:    null,
      enRetardFactures: facturesRetard.length,
      enRetardTaches:   tachesEnRetard,
    },
    meteoSocietes,
    meteoGlobal,
    caGlobalMois: caMoisNet,
    sav:      { ouverts: savOuverts, enCours: savEnCours, clotures: savClotures, hasTable: savHasTable },
    apiUsage: { tokensUsed: 0, tokenMax: 500_000 },
    priorites,
    contratsARenouveler,
  };
}
