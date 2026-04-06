'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';
import { createAdminClient } from '@/lib/supabase/server';

const PATH = '/commerce';

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

export type ClientInput = {
  nom:                  string;
  contact:              string;
  email:                string;
  tel:                  string;
  adresse:              string;
  cp:                   string;
  ville:                string;
  siret:                string;
  tva_intra:            string;
  conditions_paiement:  string;
  notes:                string;
  actif:                boolean;
};

export async function createClientAction(input: ClientInput) {
  const { admin, tenant_id } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .insert({ ...input, tenant_id });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateClientAction(id: string, input: ClientInput) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .update(input)
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteClientAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .delete()
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}


// ─── getDashboardCommerce ─────────────────────────────────────────────────────

export type QuoteStatutDash = 'brouillon' | 'envoye' | 'accepte' | 'refuse';

export interface CommerceDashboardQuote {
  id:                  string;
  number:              string;
  affair_number:       string | null;
  objet:               string | null;
  statut:              QuoteStatutDash;
  date:                string;
  validity:            string | null;
  montant_ttc:         number;
  project_created:     boolean;
  client_nom:          string;
  commercial_user_id:  string | null;
  chef_projet_user_id: string | null;
  created_at:          string;
}

export interface RelanceFactureDash {
  id:            string;
  number:        string;
  client_nom:    string;
  montant_ttc:   number;
  date_echeance: string;
  joursRetard:   number;
  niveauPending: 1 | 2 | 3;
}

export interface CommerceDashboardData {
  kpis: {
    caDevisTotal:     number;
    totalDevis:       number;
    devisAcceptes:    number;
    caEncaisse:       number;
    facturesSoldees:  number;
    aEncaisser:       number;
    facturesOuvertes: number;
    facturesEnRetard: number;
    devisEnAttente:   number;
  };
  quotesRecentes:         CommerceDashboardQuote[];
  alertesRelance:         CommerceDashboardQuote[];
  alertesRelanceFactures: RelanceFactureDash[];
  users:                  { id: string; name: string }[];
}

export async function getDashboardCommerce(tenantId: string): Promise<CommerceDashboardData> {
  const admin = await createAdminClient();
  const today       = new Date().toISOString().split('T')[0];
  const sevenAgo    = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [quotesRes, invoicesRes, usersRes] = await Promise.all([
    admin
      .from('quotes')
      .select('id, number, affair_number, objet, statut, date, validity, montant_ttc, project_created, client_id, commercial_user_id, chef_projet_user_id, created_at, clients(nom)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    admin
      .from('invoices')
      .select('id, number, status, total_ttc, date_echeance, relance_n1, relance_n2, relance_n3, clients(nom)')
      .eq('tenant_id', tenantId),
    admin
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name'),
  ]);

  if (quotesRes.error)   console.error('[getDashboardCommerce] quotes error:',   quotesRes.error);
  if (invoicesRes.error) console.error('[getDashboardCommerce] invoices error:', invoicesRes.error);
  if (usersRes.error)    console.error('[getDashboardCommerce] users error:',    usersRes.error);

  const quotes   = quotesRes.data   ?? [];
  const invoices = invoicesRes.data ?? [];
  const users    = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));

  // ── KPIs ──
  const accepted   = quotes.filter((q) => q.statut === 'accepte');
  const envoyes    = quotes.filter((q) => q.statut === 'envoye');
  const payees     = invoices.filter((f) => f.status === 'payee');
  const emises     = invoices.filter((f) => f.status === 'emise');
  const enRetard   = emises.filter((f) => f.date_echeance && (f.date_echeance as string) < today);

  const toQuote = (q: typeof quotes[0]): CommerceDashboardQuote => ({
    id:                  q.id,
    number:              q.number,
    affair_number:       q.affair_number ?? null,
    objet:               q.objet ?? null,
    statut:              q.statut as QuoteStatutDash,
    date:                q.date,
    validity:            q.validity ?? null,
    montant_ttc:         q.montant_ttc ?? 0,
    project_created:     q.project_created ?? false,
    client_nom:          (q.clients as unknown as { nom: string } | null)?.nom ?? '—',
    commercial_user_id:  q.commercial_user_id ?? null,
    chef_projet_user_id: q.chef_projet_user_id ?? null,
    created_at:          q.created_at,
  });

  // ── Relances factures ──
  const now = Date.now();
  const alertesRelanceFactures: RelanceFactureDash[] = [];
  for (const inv of enRetard) {
    const jours = Math.max(0, Math.floor((now - new Date(inv.date_echeance as string).getTime()) / 86_400_000));
    if (jours < 5) continue;
    const n1 = inv.relance_n1 ?? null;
    const n2 = inv.relance_n2 ?? null;
    const n3 = inv.relance_n3 ?? null;
    let niveauPending: 1 | 2 | 3 | null = null;
    if      (jours >= 30 && !n3) niveauPending = 3;
    else if (jours >= 15 && !n2) niveauPending = 2;
    else if (jours >= 5  && !n1) niveauPending = 1;
    if (niveauPending === null) continue;
    const clientNom = (inv.clients as unknown as { nom: string } | null)?.nom ?? '—';
    alertesRelanceFactures.push({
      id:            inv.id            as string,
      number:        inv.number        as string,
      client_nom:    clientNom,
      montant_ttc:   inv.total_ttc     as number,
      date_echeance: inv.date_echeance as string,
      joursRetard:   jours,
      niveauPending,
    });
  }

  return {
    kpis: {
      caDevisTotal:     accepted.reduce((s, q) => s + (q.montant_ttc ?? 0), 0),
      totalDevis:       quotes.length,
      devisAcceptes:    accepted.length,
      caEncaisse:       payees.reduce((s, f) => s + (f.total_ttc ?? 0), 0),
      facturesSoldees:  payees.length,
      aEncaisser:       emises.reduce((s, f) => s + (f.total_ttc ?? 0), 0),
      facturesOuvertes: emises.length,
      facturesEnRetard: enRetard.length,
      devisEnAttente:   envoyes.length,
    },
    quotesRecentes:         quotes.slice(0, 10).map(toQuote),
    alertesRelance:         envoyes.filter((q) => q.created_at < sevenAgo).map(toQuote),
    alertesRelanceFactures: alertesRelanceFactures.sort((a, b) => b.joursRetard - a.joursRetard).slice(0, 10),
    users,
  };
}

