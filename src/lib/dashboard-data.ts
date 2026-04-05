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
    quotesEnAttente,
    invoicesImpayees,
    interventionsEnCours,
    savData,
    quotesConversion,
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('total_ttc')
      .eq('status', 'payee')
      .gte('date_facture', startStr),

    supabase
      .from('invoices')
      .select('total_ttc')
      .eq('status', 'payee')
      .gte('date_facture', prevStartStr)
      .lt('date_facture', prevEndStr),

    supabase
      .from('quotes')
      .select('montant_ttc')
      .eq('statut', 'envoye'),

    supabase
      .from('invoices')
      .select('total_ttc')
      .eq('status', 'emise'),

    supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_cours'),

    supabase
      .from('sav_tickets')
      .select('date_ouverture')
      .in('statut', ['ouvert', 'en_cours']),

    supabase
      .from('quotes')
      .select('statut')
      .in('statut', ['envoye', 'accepte', 'refuse'])
      .gte('created_at', start.toISOString()),
  ]);

  const caVal    = caPeriod.data?.reduce((s, f) => s + ((f.total_ttc as number) ?? 0), 0) ?? 0;
  const caPrevVal = caPrev.data?.reduce((s, f) => s + ((f.total_ttc as number) ?? 0), 0) ?? 0;
  const caVariation = caPrevVal > 0
    ? Math.round(((caVal - caPrevVal) / caPrevVal) * 100)
    : null;

  const devisCount = quotesEnAttente.data?.length ?? 0;
  const devisTotal = quotesEnAttente.data?.reduce((s, d) => s + ((d.montant_ttc as number) ?? 0), 0) ?? 0;

  const impayeesCount = invoicesImpayees.data?.length ?? 0;
  const impayeesTotal = invoicesImpayees.data?.reduce((s, f) => s + ((f.total_ttc as number) ?? 0), 0) ?? 0;

  const interventionsCount = interventionsEnCours.count ?? 0;

  const savList  = savData.data ?? [];
  const savCount = savList.length;
  const savAvgH  = savCount > 0
    ? Math.round(
        savList.reduce((s, t) => {
          return s + (Date.now() - new Date(t.date_ouverture).getTime()) / 3_600_000;
        }, 0) / savCount
      )
    : 0;

  const quotesAll      = quotesConversion.data ?? [];
  const quotesAcceptes = quotesAll.filter((d) => d.statut === 'accepte').length;
  const tauxConversion = quotesAll.length > 0
    ? Math.round((quotesAcceptes / quotesAll.length) * 100)
    : null;

  return {
    ca:            { value: caVal,         variation: caVariation },
    devis:         { count: devisCount,    total: devisTotal },
    impayees:      { count: impayeesCount, total: impayeesTotal },
    interventions: { count: interventionsCount },
    sav:           { count: savCount,      avgHours: savAvgH },
    conversion:    { pct: tauxConversion },
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

  const [recentQuotes, recentInvoices, recentInterventions, recentSav] =
    await Promise.all([
      supabase
        .from('quotes')
        .select('id, number, statut, created_at, clients(nom)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('invoices')
        .select('id, number, status, created_at, clients(nom)')
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

  for (const d of recentQuotes.data ?? []) {
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
      description: `${labels[d.statut] ?? 'Devis'} — ${clientNom} (n°${d.number})`,
      timestamp:   d.created_at,
    });
  }

  for (const f of recentInvoices.data ?? []) {
    const clientNom = (f.clients as unknown as { nom: string } | null)?.nom ?? 'Client';
    const labels: Record<string, string> = {
      brouillon: 'Facture créée',
      emise:     'Facture envoyée',
      payee:     'Facture payée',
    };
    items.push({
      id:          `facture-${f.id}`,
      type:        'facture',
      description: `${labels[f.status] ?? 'Facture'} — ${clientNom} (n°${f.number})`,
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

  const thirtyDaysAgo  = dateISO(subtractDays(now, 30));
  const fortyEightHAgo = subtractDays(now, 2).toISOString();
  const today          = dateISO(now);

  const [overdueInvoices, expiredQuotes, savDelayed] = await Promise.all([
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['emise'])
      .lt('date_echeance', thirtyDaysAgo),

    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'envoye')
      .lt('validity', today),

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

  const expiredCount = expiredQuotes.count ?? 0;
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
