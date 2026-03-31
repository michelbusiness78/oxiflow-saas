'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuoteStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse';

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

export interface Quote {
  id:          string;
  number:      string;
  client_id:   string | null;
  objet:       string | null;
  date:        string;
  validity:    string | null;
  statut:      QuoteStatut;
  lignes:      QuoteLigne[];
  notes:       string | null;
  conditions:  string | null;
  montant_ht:  number;
  tva_amount:  number;
  montant_ttc: number;
  created_at:  string;
}

export type QuoteInput = {
  client_id:   string | null;
  objet:       string;
  date:        string;
  validity:    string;
  lignes:      QuoteLigne[];
  notes:       string;
  conditions:  string;
  montant_ht:  number;
  tva_amount:  number;
  montant_ttc: number;
};

// ─── Numérotation ─────────────────────────────────────────────────────────────

async function nextQuoteNumber(
  admin: Awaited<ReturnType<typeof getAuthContext>>['admin'],
  tenant_id: string,
  userName: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const raw  = (userName ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const code = raw.slice(0, 4) || 'OXI';
  const prefix = `DEV-${code}-${year}-`;

  const { count } = await admin
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .like('number', `${prefix}%`);

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// ─── Actions CRUD ─────────────────────────────────────────────────────────────

export async function saveQuoteAction(
  input: QuoteInput,
  id?: string,
): Promise<{ success?: true; id?: string; error?: string }> {
  const { admin, tenant_id, name } = await getAuthContext();

  if (id) {
    // Update
    const { error } = await admin
      .from('quotes')
      .update({
        client_id:   input.client_id,
        objet:       input.objet || null,
        date:        input.date,
        validity:    input.validity || null,
        lignes:      input.lignes,
        notes:       input.notes || null,
        conditions:  input.conditions || null,
        montant_ht:  input.montant_ht,
        tva_amount:  input.tva_amount,
        montant_ttc: input.montant_ttc,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    return { success: true, id };
  }

  // Create
  const number = await nextQuoteNumber(admin, tenant_id, name);

  const { data, error } = await admin
    .from('quotes')
    .insert({
      tenant_id,
      number,
      client_id:   input.client_id,
      objet:       input.objet || null,
      date:        input.date,
      validity:    input.validity || null,
      lignes:      input.lignes,
      notes:       input.notes || null,
      conditions:  input.conditions || null,
      montant_ht:  input.montant_ht,
      tva_amount:  input.tva_amount,
      montant_ttc: input.montant_ttc,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true, id: data.id };
}

export async function deleteQuoteAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('quotes').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeQuoteStatutAction(id: string, statut: QuoteStatut) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('quotes')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function duplicateQuoteAction(id: string) {
  const { admin, tenant_id, name } = await getAuthContext();

  const { data: source, error: fetchErr } = await admin
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !source) return { error: fetchErr?.message ?? 'Devis introuvable' };

  const number = await nextQuoteNumber(admin, tenant_id, name);

  const { error } = await admin
    .from('quotes')
    .insert({
      tenant_id,
      number,
      client_id:   source.client_id,
      objet:       source.objet ? `(Copie) ${source.objet}` : '(Copie)',
      date:        new Date().toISOString().split('T')[0],
      validity:    source.validity,
      statut:      'brouillon',
      lignes:      source.lignes,
      notes:       source.notes,
      conditions:  source.conditions,
      montant_ht:  source.montant_ht,
      tva_amount:  source.tva_amount,
      montant_ttc: source.montant_ttc,
    });

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
