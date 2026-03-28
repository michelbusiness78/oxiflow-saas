import { createClient } from '@/lib/supabase/server';

export type Period = '7j' | '30j' | '90j' | '12m';

export function periodToDays(period: Period): number {
  return period === '7j' ? 7 : period === '30j' ? 30 : period === '90j' ? 90 : 365;
}

function dateISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKPIs(period: Period) {
  const supabase = await createClient();
  const days     = periodToDays(period);
  const now      = new Date();
  const start    = subtractDays(now, days);
  const prevStart = subtractDays(start, days);
  const startStr  = dateISO(start);
  const prevStartStr = dateISO(prevStart);
  const prevEndStr   = dateISO(start);

  const [
    caPeriod,
    caPrev,
    devisEnAttente,
    facturesImpayees,
    interventionsEnCours,
    savData,
    devisConversion,
  ] = await Promise.all([
    // CA période courante
    supabase
      .from('factures')
      .select('montant_ttc')
      .eq('statut', 'payee')
      .gte('date', startStr),

    // CA période précédente (pour variation)
    supabase
      .from('factures')
      .select('montant_ttc')
      .eq('statut', 'payee')
      .gte('date', prevStartStr)
      .lt('date', prevEndStr),

    // Devis en attente (état courant)
    supabase
      .from('devis')
      .select('montant_ttc')
      .eq('statut', 'envoye'),

    // Factures impayées (état courant)
    supabase
      .from('factures')
      .select('montant_ttc')
      .eq('statut', 'impayee'),

    // Interventions en cours (état courant)
    supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_cours'),

    // SAV ouverts + délai moyen
    supabase
      .from('sav_tickets')
      .select('date_ouverture')
      .in('statut', ['ouvert', 'en_cours']),

    // Taux de conversion devis (période)
    supabase
      .from('devis')
      .select('statut')
      .in('statut', ['envoye', 'accepte', 'refuse'])
      .gte('created_at', start.toISOString()),
  ]);

  const caVal   = caPeriod.data?.reduce((s, f) => s + (f.montant_ttc ?? 0), 0) ?? 0;
  const caPrevVal = caPrev.data?.reduce((s, f) => s + (f.montant_ttc ?? 0), 0) ?? 0;
  const caVariation = caPrevVal > 0
    ? Math.round(((caVal - caPrevVal) / caPrevVal) * 100)
    : null;

  const devisCount   = devisEnAttente.data?.length ?? 0;
  const devisTotal   = devisEnAttente.data?.reduce((s, d) => s + (d.montant_ttc ?? 0), 0) ?? 0;

  const impayeesCount = facturesImpayees.data?.length ?? 0;
  const impayeesTotal = facturesImpayees.data?.reduce((s, f) => s + (f.montant_ttc ?? 0), 0) ?? 0;

  const interventionsCount = interventionsEnCours.count ?? 0;

  const savList    = savData.data ?? [];
  const savCount   = savList.length;
  const savAvgH    = savCount > 0
    ? Math.round(
        savList.reduce((s, t) => {
          return s + (Date.now() - new Date(t.date_ouverture).getTime()) / 3_600_000;
        }, 0) / savCount
      )
    : 0;

  const devisAll      = devisConversion.data ?? [];
  const devisAcceptes = devisAll.filter((d) => d.statut === 'accepte').length;
  const tauxConversion = devisAll.length > 0
    ? Math.round((devisAcceptes / devisAll.length) * 100)
    : null;

  return {
    ca:             { value: caVal,          variation: caVariation },
    devis:          { count: devisCount,     total: devisTotal },
    impayees:       { count: impayeesCount,  total: impayeesTotal },
    interventions:  { count: interventionsCount },
    sav:            { count: savCount,       avgHours: savAvgH },
    conversion:     { pct: tauxConversion },
  };
}

// ─── Activité récente ─────────────────────────────────────────────────────────

export interface ActivityItem {
  id:          string;
  type:        'devis' | 'facture' | 'intervention' | 'sav';
  description: string;
  timestamp:   string;
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient();

  const [recentDevis, recentFactures, recentInterventions, recentSav] =
    await Promise.all([
      supabase
        .from('devis')
        .select('id, num, statut, created_at, clients(nom)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('factures')
        .select('id, num, statut, created_at, clients(nom)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('interventions')
        .select('id, type, statut, created_at, clients(nom)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('sav_tickets')
        .select('id, statut, created_at, clients(nom)')
        .order('created_at', { ascending: false })
        .limit(4),
    ]);

  const items: ActivityItem[] = [];

  for (const d of recentDevis.data ?? []) {
    const clientNom = (d.clients as unknown as { nom: string } | null)?.nom ?? 'Client';
    const labels: Record<string, string> = {
      brouillon: 'Devis brouillon créé',
      envoye:    'Devis envoyé',
      accepte:   'Devis accepté',
      refuse:    'Devis refusé',
    };
    items.push({
      id:          `devis-${d.id}`,
      type:        'devis',
      description: `${labels[d.statut] ?? 'Devis'} — ${clientNom} (n°${d.num})`,
      timestamp:   d.created_at,
    });
  }

  for (const f of recentFactures.data ?? []) {
    const clientNom = (f.clients as unknown as { nom: string } | null)?.nom ?? 'Client';
    const labels: Record<string, string> = {
      brouillon: 'Facture créée',
      envoyee:   'Facture envoyée',
      payee:     'Facture payée',
      impayee:   'Facture marquée impayée',
      partielle: 'Paiement partiel reçu',
    };
    items.push({
      id:          `facture-${f.id}`,
      type:        'facture',
      description: `${labels[f.statut] ?? 'Facture'} — ${clientNom} (n°${f.num})`,
      timestamp:   f.created_at,
    });
  }

  for (const i of recentInterventions.data ?? []) {
    const clientNom = (i.clients as unknown as { nom: string } | null)?.nom ?? 'Client';
    const types: Record<string, string> = {
      installation: 'Installation',
      maintenance:  'Maintenance',
      sav:          'SAV',
      depannage:    'Dépannage',
    };
    items.push({
      id:          `intervention-${i.id}`,
      type:        'intervention',
      description: `${types[i.type] ?? 'Intervention'} — ${clientNom}`,
      timestamp:   i.created_at,
    });
  }

  for (const t of recentSav.data ?? []) {
    const clientNom = (t.clients as unknown as { nom: string } | null)?.nom ?? 'Client';
    items.push({
      id:          `sav-${t.id}`,
      type:        'sav',
      description: `Ticket SAV ${t.statut} — ${clientNom}`,
      timestamp:   t.created_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

export interface Alert {
  id:       string;
  severity: 'warning' | 'danger';
  message:  string;
  count:    number;
  href:     string;
}

export async function fetchAlerts(): Promise<Alert[]> {
  const supabase = await createClient();
  const now      = new Date();

  const thirtyDaysAgo   = dateISO(subtractDays(now, 30));
  const fortyEightHAgo  = subtractDays(now, 2).toISOString();
  const today           = dateISO(now);

  const [overdueInvoices, expiredDevis, savDelayed] = await Promise.all([
    supabase
      .from('factures')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['envoyee', 'impayee'])
      .lt('echeance', thirtyDaysAgo),

    supabase
      .from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'envoye')
      .lt('validite', today),

    supabase
      .from('sav_tickets')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['ouvert', 'en_cours'])
      .lt('date_ouverture', fortyEightHAgo),
  ]);

  const alerts: Alert[] = [];

  const overdueCount = overdueInvoices.count ?? 0;
  if (overdueCount > 0) {
    alerts.push({
      id:       'overdue-invoices',
      severity: 'danger',
      message:  `${overdueCount} facture${overdueCount > 1 ? 's' : ''} en retard de plus de 30 jours`,
      count:    overdueCount,
      href:     '/commerce',
    });
  }

  const expiredCount = expiredDevis.count ?? 0;
  if (expiredCount > 0) {
    alerts.push({
      id:       'expired-devis',
      severity: 'warning',
      message:  `${expiredCount} devis${expiredCount > 1 ? '' : ''} expiré${expiredCount > 1 ? 's' : ''} sans relance`,
      count:    expiredCount,
      href:     '/commerce',
    });
  }

  const savCount = savDelayed.count ?? 0;
  if (savCount > 0) {
    alerts.push({
      id:       'sav-delayed',
      severity: 'warning',
      message:  `${savCount} ticket${savCount > 1 ? 's' : ''} SAV sans réponse depuis plus de 48h`,
      count:    savCount,
      href:     '/technicien',
    });
  }

  return alerts;
}
