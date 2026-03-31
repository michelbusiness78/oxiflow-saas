'use server';

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
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateClientAction(id: string, input: ClientInput) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .update(input)
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteClientAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .delete()
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── DEVIS ────────────────────────────────────────────────────────────────────

export type DevisLigne = {
  designation: string;
  quantite:    number;
  prix_ht:     number;
  tva_pct:     number;
  remise_pct:  number;
};

export type DevisInput = {
  client_id:   string;
  date:        string;
  validite:    string;
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
  statut:      'brouillon' | 'envoye';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextDevisNum(admin: any, tenant_id: string): Promise<string> {
  const { count } = await admin
    .from('devis')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);
  const n = (count ?? 0) + 1;
  return `DEV-${String(n).padStart(3, '0')}`;
}

export async function createDevisAction(input: DevisInput) {
  const { admin, tenant_id, user } = await getAuthContext();
  const num = await nextDevisNum(admin, tenant_id);
  const { error } = await admin.from('devis').insert({
    ...input,
    num,
    tenant_id,
    commercial_id: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateDevisAction(id: string, input: Partial<DevisInput>) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('devis').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteDevisAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('devis').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeDevisStatutAction(
  id: string,
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse',
) {
  const { admin, tenant_id, user } = await getAuthContext();
  const { error } = await admin.from('devis').update({ statut }).eq('id', id);
  if (error) return { error: error.message };

  // Création automatique d'un projet quand le devis est accepté
  if (statut === 'accepte') {
    const { data: devis } = await admin
      .from('devis')
      .select('id, num, client_id, montant_ht, clients(nom)')
      .eq('id', id)
      .single();

    if (devis) {
      const { data: existing } = await admin
        .from('projets')
        .select('id')
        .eq('devis_id', id)
        .maybeSingle();

      if (!existing) {
        const clientNom = (devis.clients as unknown as { nom: string } | null)?.nom ?? '';
        await admin.from('projets').insert({
          tenant_id,
          client_id:      devis.client_id,
          devis_id:       devis.id,
          chef_projet_id: user.id,
          nom:            `Projet ${clientNom} — ${devis.num}`,
          statut:         'en_attente',
          pct_avancement: 0,
          montant_ht:     devis.montant_ht,
        });
      }
    }
  }

  revalidatePath(PATH);
  revalidatePath('/projets');
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
  quotesRecentes: CommerceDashboardQuote[];
  alertesRelance: CommerceDashboardQuote[];
  users:          { id: string; name: string }[];
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
      .select('id, status, total_ttc, date_echeance')
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
    quotesRecentes: quotes.slice(0, 10).map(toQuote),
    alertesRelance: envoyes.filter((q) => q.created_at < sevenAgo).map(toQuote),
    users,
  };
}

export async function dupliquerDevisAction(id: string) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { data: original, error: fetchErr } = await admin
    .from('devis')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !original) return { error: 'Devis introuvable.' };

  const num = await nextDevisNum(admin, tenant_id);
  const today = new Date().toISOString().split('T')[0];

  const { error } = await admin.from('devis').insert({
    tenant_id,
    client_id:     original.client_id,
    commercial_id: user.id,
    num,
    date:          today,
    validite:      original.validite,
    statut:        'brouillon',
    lignes:        original.lignes,
    montant_ht:    original.montant_ht,
    tva:           original.tva,
    montant_ttc:   original.montant_ttc,
  });

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
