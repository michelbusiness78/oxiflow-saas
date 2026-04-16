'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuoteStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'facture';

export interface QuoteLigne {
  id:            string;
  reference:     string;
  designation:   string;
  description:   string;
  quantite:      number;
  unite:         string;
  prix_unitaire: number;
  tva:           number;
  remise_pct:    number;
  total_ht:      number;
}

export interface SendHistoryEntry {
  sent_at: string;   // ISO timestamp
  to:      string;   // adresse destinataire
  subject: string;   // objet de l'email
  sent_by: string;   // prénom + nom de l'utilisateur
}

export interface Quote {
  id:                  string;
  number:              string;
  affair_number:       string | null;
  client_id:           string | null;
  commercial_user_id:  string | null;
  chef_projet_user_id: string | null;
  objet:               string | null;
  date:                string;
  validity:            string | null;
  statut:              QuoteStatut;
  lignes:              QuoteLigne[];
  notes:               string | null;
  conditions:          string | null;
  deposit_percent:     number;
  montant_ht:          number;
  tva_amount:          number;
  montant_ttc:         number;
  company_id:          string | null;
  project_created:     boolean;
  project_id:          string | null;
  created_at:          string;
  send_history:        SendHistoryEntry[];
}

export type QuoteInput = {
  client_id:           string | null;
  company_id:          string | null;
  chef_projet_user_id: string | null;
  objet:               string;
  date:                string;
  validity:            string;
  lignes:              QuoteLigne[];
  notes:               string;
  conditions:          string;
  deposit_percent:     number;
  montant_ht:          number;
  tva_amount:          number;
  montant_ttc:         number;
};

// ─── Numérotation ─────────────────────────────────────────────────────────────

type AdminClient = Awaited<ReturnType<typeof getAuthContext>>['admin'];

async function nextQuoteNumbers(
  admin: AdminClient,
  tenant_id: string,
): Promise<{ number: string; affair_number: string }> {
  const year      = new Date().getFullYear();
  const devPrefix = `DEV-${year}-`;

  const { count } = await admin
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .like('number', `${devPrefix}%`);

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return {
    number:        `DEV-${year}-${seq}`,
    affair_number: `AF-${year}-${seq}`,
  };
}

// ─── Actions CRUD ─────────────────────────────────────────────────────────────

export async function saveQuoteAction(
  input: QuoteInput,
  id?: string,
): Promise<{ success?: true; id?: string; error?: string }> {
  const { admin, tenant_id, name, user } = await getAuthContext();

  const common = {
    client_id:           input.client_id,
    company_id:          input.company_id || null,
    chef_projet_user_id: input.chef_projet_user_id || null,
    objet:               input.objet || null,
    date:                input.date,
    validity:            input.validity || null,
    lignes:              input.lignes,
    notes:               input.notes || null,
    conditions:          input.conditions || null,
    deposit_percent:     input.deposit_percent,
    montant_ht:          input.montant_ht,
    tva_amount:          input.tva_amount,
    montant_ttc:         input.montant_ttc,
  };

  if (id) {
    const { error } = await admin
      .from('quotes')
      .update({ ...common, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: translateSupabaseError(error.message) };
    revalidatePath(PATH);
    return { success: true, id };
  }

  const { number, affair_number } = await nextQuoteNumbers(admin, tenant_id);

  const { data, error } = await admin
    .from('quotes')
    .insert({
      tenant_id,
      number,
      affair_number,
      commercial_user_id: user.id,
      ...common,
    })
    .select('id')
    .single();

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true, id: data.id };
}

export async function deleteQuoteAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('quotes').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeQuoteStatutAction(id: string, statut: QuoteStatut) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('quotes')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── Modèles de devis ─────────────────────────────────────────────────────────

export interface QuoteTemplate {
  id:         string;
  nom:        string;
  objet:      string | null;
  lignes:     QuoteLigne[];
  conditions: string | null;
  notes:      string | null;
  created_at: string;
}

export async function saveQuoteTemplateAction(
  nom: string,
  quoteId: string,
): Promise<{ success?: true; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { data: q, error: qErr } = await admin
    .from('quotes')
    .select('objet, lignes, conditions, notes')
    .eq('id', quoteId)
    .single();

  if (qErr || !q) return { error: 'Devis introuvable.' };

  const { error } = await admin
    .from('quote_templates')
    .insert({ tenant_id, nom, objet: q.objet, lignes: q.lignes, conditions: q.conditions, notes: q.notes });

  if (error) return { error: translateSupabaseError(error.message) };
  return { success: true };
}

export async function getQuoteTemplatesAction(): Promise<QuoteTemplate[]> {
  const { admin, tenant_id } = await getAuthContext();
  const { data } = await admin
    .from('quote_templates')
    .select('id, nom, objet, lignes, conditions, notes, created_at')
    .eq('tenant_id', tenant_id)
    .order('nom');
  return (data ?? []).map((t) => ({
    id:         t.id         as string,
    nom:        t.nom        as string,
    objet:      (t.objet     as string | null) ?? null,
    lignes:     (t.lignes    as QuoteLigne[]) ?? [],
    conditions: (t.conditions as string | null) ?? null,
    notes:      (t.notes     as string | null) ?? null,
    created_at: t.created_at as string,
  }));
}

export async function deleteQuoteTemplateAction(id: string): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('quote_templates').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  return { success: true };
}

export async function duplicateQuoteAction(id: string) {
  const { admin, tenant_id, name, user } = await getAuthContext();

  const { data: source, error: fetchErr } = await admin
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !source) return { error: fetchErr?.message ?? 'Devis introuvable' };

  const { number, affair_number } = await nextQuoteNumbers(admin, tenant_id);

  const { error } = await admin
    .from('quotes')
    .insert({
      tenant_id,
      number,
      affair_number,
      commercial_user_id:  user.id,
      chef_projet_user_id: source.chef_projet_user_id,
      client_id:           source.client_id,
      objet:               source.objet ? `(Copie) ${source.objet}` : '(Copie)',
      date:                new Date().toISOString().split('T')[0],
      validity:            source.validity,
      statut:              'brouillon',
      lignes:              source.lignes,
      notes:               source.notes,
      conditions:          source.conditions,
      deposit_percent:     source.deposit_percent ?? 0,
      montant_ht:          source.montant_ht,
      tva_amount:          source.tva_amount,
      montant_ttc:         source.montant_ttc,
    });

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}
