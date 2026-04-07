'use server';

import { createAdminClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeteoSociete {
  id:         string;
  nom:        string;
  color:      string;
  caMois:     number;
  avoirs:     number;
  caNet:      number;
  objectif:   number | null;
  pct:        number | null;
  meteo:      'green' | 'orange' | 'red' | 'unknown';
  caPrevMois: number;
  variation:  number | null;
  caAnnuel:   number;
  objAnnuel:  number | null;
  pctAnnuel:  number | null;
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

export interface AlerteItem {
  type:     'facture' | 'contrat' | 'projet' | 'sav';
  id:       string;
  label:    string;
  severity: 'red' | 'orange';
  href:     string;
}

export interface SAVStats {
  ouverts:             number;
  enCours:             number;
  clotures:            number;
  cloturesCeMois:      number;
  hasTable:            boolean;
  urgents:             number;
  delaiMoyenHeures:    number | null;
  tauxSousContrat:     number | null;
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
  meteoSocietes:       MeteoSociete[];
  meteoGlobal:         'green' | 'orange' | 'red' | 'unknown';
  caGlobalMois:        number;
  sav:                 SAVStats;
  apiUsage: {
    tokensUsed: number;
    tokenMax:   number;
    requests:   number;
    quota:      number;
  };
  priorites:           PrioriteItem[];
  contratsARenouveler: number;
  alertes:             AlerteItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9'];

function sum(rows: { total_ttc?: number | null }[]) {
  return rows.reduce((s, r) => s + (r.total_ttc ?? 0), 0);
}

// Quota par plan Stripe
const QUOTA_MAP: Record<string, number> = {
  solo:  50,
  team:  200,
  pro:   500,
  enterprise: 2000,
};

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
  const monthISO       = monthStart;
  const thirtyDaysAgo  = new Date(now.getTime() - 30 * 86_400_000).toISOString().split('T')[0];
  const in30Days       = new Date(now.getTime() + 30 * 86_400_000).toISOString().split('T')[0];
  const fifteenAgo     = new Date(now.getTime() - 15 * 86_400_000).toISOString();

  const [
    userRes,
    facturesMoisRes,
    facturesPrevRes,
    facturesAnnuelRes,
    avoirsMoisRes,
    facturesRetardRes,
    quotesRelanceRes,
    taskRetardRes,
    contratsRes,
    projetsRetardRes,
    savAllRes,
    savUrgentsRes,
    apiUsageRes,
    subscriptionRes,
  ] = await Promise.all([
    admin.from('users').select('name').eq('id', userId).single(),

    admin.from('invoices').select('total_ttc, company_id')
      .eq('tenant_id', tenantId).eq('status', 'payee')
      .neq('type', 'avoir')
      .gte('date_facture', monthStart),

    admin.from('invoices').select('total_ttc, company_id')
      .eq('tenant_id', tenantId).eq('status', 'payee')
      .neq('type', 'avoir')
      .gte('date_facture', prevMonthStart).lte('date_facture', prevMonthEnd),

    admin.from('invoices').select('total_ttc, company_id')
      .eq('tenant_id', tenantId).eq('status', 'payee')
      .neq('type', 'avoir')
      .gte('date_facture', yearStart),

    admin.from('invoices').select('total_ttc, company_id')
      .eq('tenant_id', tenantId).eq('type', 'avoir')
      .gte('date_facture', monthStart),

    admin.from('invoices').select('id, number, total_ttc, date_echeance, company_id')
      .eq('tenant_id', tenantId).eq('status', 'emise').lt('date_echeance', todayISO),

    admin.from('quotes').select('id, number, objet, montant_ttc, created_at, clients(nom)')
      .eq('tenant_id', tenantId).eq('statut', 'envoye')
      .lt('created_at', fifteenAgo).order('created_at', { ascending: false }).limit(5),

    admin.from('project_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('done', false)
      .not('due', 'is', null).lt('due', todayISO),

    admin.from('contrats')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('actif', true)
      .not('date_fin', 'is', null).lte('date_fin', in30Days),

    admin.from('projects')
      .select('id, name', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'termine')
      .not('deadline', 'is', null)
      .lt('deadline', todayISO)
      .limit(5),

    // SAV: tous les tickets
    admin.from('sav_tickets')
      .select('id, statut, priorite, contrat_id, date_ouverture, closed_at')
      .eq('tenant_id', tenantId),

    // SAV urgents ouverts depuis > 48h
    admin.from('sav_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('statut', ['ouvert', 'en_cours'])
      .eq('priorite', 'urgente'),

    // API usage du mois en cours
    admin.from('api_usage')
      .select('tokens_in, tokens_out, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),

    // Plan abonnement
    admin.from('subscriptions')
      .select('plan, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1),
  ]);

  const userName       = (userRes.data?.name as string | null) ?? '';
  const facturesMois   = facturesMoisRes.data   ?? [];
  const facturesPrev   = facturesPrevRes.data   ?? [];
  const facturesAnnuel = facturesAnnuelRes.data ?? [];
  const avoirsMois     = avoirsMoisRes.data      ?? [];
  const facturesRetard = facturesRetardRes.data  ?? [];
  const quotesRelance  = quotesRelanceRes.data   ?? [];
  const tachesEnRetard       = taskRetardRes.count   ?? 0;
  const contratsARenouveler  = contratsRes.count     ?? 0;
  const projetsRetard        = projetsRetardRes.data ?? [];
  const savAll         = savAllRes.data            ?? [];
  const savUrgents     = savUrgentsRes.count        ?? 0;
  const apiUsageRows   = apiUsageRes.data            ?? [];
  const subscriptions  = subscriptionRes.data        ?? [];

  // ── Calculs CA globaux ──────────────────────────────────────────────────────
  const caMoisBrut      = sum(facturesMois);
  const avoirsMoisTotal = Math.abs(sum(avoirsMois));
  const caMoisNet       = Math.max(0, caMoisBrut - avoirsMoisTotal);
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

  // ── Objectifs par société ────────────────────────────────────────────────────
  const [companiesRes, objectivesRes] = await Promise.allSettled([
    admin.from('companies').select('id, nom, color').eq('tenant_id', tenantId).order('nom'),
    admin.from('company_objectives')
      .select('company_id, monthly_target, annual_target')
      .eq('tenant_id', tenantId)
      .eq('year', now.getFullYear()),
  ]);

  const companies  = companiesRes.status  === 'fulfilled' ? (companiesRes.value.data  ?? []) : [];
  const objectives = objectivesRes.status === 'fulfilled' ? (objectivesRes.value.data ?? []) : [];

  const objByCompany = new Map<string, { monthly_target: number; annual_target: number }>();
  for (const o of objectives) {
    objByCompany.set(o.company_id as string, {
      monthly_target: (o.monthly_target as number) ?? 0,
      annual_target:  (o.annual_target as number)  ?? 0,
    });
  }

  // CA par société
  function caForCompany(rows: { total_ttc?: number | null; company_id?: string | null }[], companyId: string) {
    return rows.filter((r) => r.company_id === companyId).reduce((s, r) => s + (r.total_ttc ?? 0), 0);
  }

  const meteoSocietes: MeteoSociete[] = companies.map((c, i) => {
    const cid     = c.id as string;
    const obj     = objByCompany.get(cid) ?? null;
    const caMois  = caForCompany(facturesMois, cid);
    const avoirs  = Math.abs(caForCompany(avoirsMois, cid));
    const caNet   = Math.max(0, caMois - avoirs);
    const caPrev  = caForCompany(facturesPrev, cid);
    const caAnn   = caForCompany(facturesAnnuel, cid);
    const objM    = obj?.monthly_target ?? null;
    const objA    = obj?.annual_target  ?? null;
    const pct     = objM && objM > 0 ? Math.min(200, Math.round((caNet / objM) * 100)) : null;
    const pctAnn  = objA && objA > 0 ? Math.min(200, Math.round((caAnn / objA) * 100)) : null;
    const vari    = caPrev > 0 ? Math.round(((caNet - caPrev) / caPrev) * 100) : null;

    let meteo: MeteoSociete['meteo'] = 'unknown';
    if (objM && objM > 0) {
      meteo = pct! >= 80 ? 'green' : pct! >= 50 ? 'orange' : 'red';
    } else if (caPrev > 0) {
      meteo = caNet >= caPrev * 0.8 ? 'green' : caNet >= caPrev * 0.5 ? 'orange' : 'red';
    }

    return {
      id:         cid,
      nom:        c.nom as string,
      color:      (c.color as string | null) ?? PALETTE[i % PALETTE.length],
      caMois,
      avoirs,
      caNet,
      objectif:   objM,
      pct,
      meteo,
      caPrevMois: caPrev,
      variation:  vari,
      caAnnuel:   caAnn,
      objAnnuel:  objA,
      pctAnnuel:  pctAnn,
    };
  });

  // Fallback: si pas de société, calculer globalement
  if (meteoSocietes.length === 0) {
    meteoSocietes.push({
      id: 'global', nom: 'Entreprise',
      color: PALETTE[0],
      caMois: caMoisBrut, avoirs: avoirsMoisTotal, caNet: caMoisNet,
      objectif: null, pct: null, meteo: meteoGlobal,
      caPrevMois: caMoisPrecedent, variation: variationMois,
      caAnnuel, objAnnuel: null, pctAnnuel: null,
    });
  }

  // ── SAV ──────────────────────────────────────────────────────────────────────
  const savHasTable  = savAll.length > 0 || savAllRes.error?.code !== '42P01';
  const savOuverts   = savAll.filter((t) => t.statut === 'ouvert').length;
  const savEnCours   = savAll.filter((t) => t.statut === 'en_cours').length;
  const savClotures  = savAll.filter((t) => ['cloture', 'ferme', 'resolu', 'termine'].includes(t.statut ?? '')).length;

  // Clôturés ce mois
  const savClotureMois = savAll.filter((t) => {
    if (!['cloture', 'ferme', 'resolu', 'termine'].includes(t.statut ?? '')) return false;
    const closedAt = (t.closed_at as string | null) ?? (t.date_ouverture as string | null);
    return closedAt && closedAt >= monthISO;
  }).length;

  // Délai moyen (tickets avec closed_at)
  const closedWithDate = savAll.filter((t) => t.closed_at && t.date_ouverture);
  let delaiMoyen: number | null = null;
  if (closedWithDate.length > 0) {
    const totalH = closedWithDate.reduce((s, t) => {
      const h = (new Date(t.closed_at as string).getTime() - new Date(t.date_ouverture as string).getTime()) / 3_600_000;
      return s + Math.max(0, h);
    }, 0);
    delaiMoyen = Math.round(totalH / closedWithDate.length);
  }

  // Taux sous contrat (tickets ouverts + en_cours avec contrat_id)
  const actifs = savAll.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours');
  const sousContrat = actifs.filter((t) => t.contrat_id).length;
  const tauxSousContrat = actifs.length > 0 ? Math.round((sousContrat / actifs.length) * 100) : null;

  // ── API Usage ─────────────────────────────────────────────────────────────────
  const tokensUsed = apiUsageRows.reduce((s, r) => s + ((r.tokens_in as number) ?? 0) + ((r.tokens_out as number) ?? 0), 0);
  const requests   = apiUsageRows.length;

  const plan  = (subscriptions[0]?.plan as string | null) ?? 'solo';
  const quota = QUOTA_MAP[plan.toLowerCase()] ?? 50;
  const tokenMax = quota * 10_000;  // Estimation: 10k tokens par requête en moyenne

  // ── Alertes critiques ─────────────────────────────────────────────────────────
  const alertes: AlerteItem[] = [];

  for (const f of facturesRetard.slice(0, 5)) {
    alertes.push({
      type: 'facture', id: f.id as string,
      label: `Facture ${f.number as string} en retard — ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(f.total_ttc as number)}`,
      severity: 'red', href: '/commerce?tab=factures&filter=retard',
    });
  }

  if (contratsARenouveler > 0) {
    alertes.push({
      type: 'contrat', id: 'contrats',
      label: `${contratsARenouveler} contrat${contratsARenouveler > 1 ? 's' : ''} arrivant à échéance`,
      severity: 'orange', href: '/commerce?tab=contrats',
    });
  }

  for (const p of projetsRetard.slice(0, 3)) {
    alertes.push({
      type: 'projet', id: p.id as string,
      label: `Projet "${p.name as string}" en retard`,
      severity: 'orange', href: '/chef-projet',
    });
  }

  if (savUrgents > 0) {
    alertes.push({
      type: 'sav', id: 'sav-urgents',
      label: `${savUrgents} ticket${savUrgents > 1 ? 's' : ''} SAV urgent${savUrgents > 1 ? 's' : ''}`,
      severity: 'red', href: '/chef-projet',
    });
  }

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
    sav: {
      ouverts:          savOuverts,
      enCours:          savEnCours,
      clotures:         savClotures,
      cloturesCeMois:   savClotureMois,
      hasTable:         savHasTable,
      urgents:          savUrgents,
      delaiMoyenHeures: delaiMoyen,
      tauxSousContrat,
    },
    apiUsage: { tokensUsed, tokenMax, requests, quota },
    priorites,
    contratsARenouveler,
    alertes,
  };
}
