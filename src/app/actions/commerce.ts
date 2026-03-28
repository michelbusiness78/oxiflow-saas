'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const PATH = '/commerce';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Profil introuvable');

  return { supabase, user, tenant_id: profile.tenant_id };
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

export type ClientInput = {
  nom:     string;
  contact: string;
  email:   string;
  tel:     string;
  adresse: string;
  cp:      string;
  ville:   string;
  notes:   string;
};

export async function createClientAction(input: ClientInput) {
  const { supabase, tenant_id } = await getAuthContext();
  const { error } = await supabase
    .from('clients')
    .insert({ ...input, tenant_id });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateClientAction(id: string, input: ClientInput) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase
    .from('clients')
    .update(input)
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteClientAction(id: string) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase
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

async function nextDevisNum(tenant_id: string): Promise<string> {
  const admin = await createAdminClient();
  const { count } = await admin
    .from('devis')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);
  const n = (count ?? 0) + 1;
  return `DEV-${String(n).padStart(3, '0')}`;
}

export async function createDevisAction(input: DevisInput) {
  const { supabase, tenant_id, user } = await getAuthContext();
  const num = await nextDevisNum(tenant_id);
  const { error } = await supabase.from('devis').insert({
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
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('devis').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteDevisAction(id: string) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('devis').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeDevisStatutAction(
  id: string,
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse',
) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('devis').update({ statut }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function dupliquerDevisAction(id: string) {
  const { supabase, tenant_id, user } = await getAuthContext();

  const { data: original, error: fetchErr } = await supabase
    .from('devis')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !original) return { error: 'Devis introuvable.' };

  const num = await nextDevisNum(tenant_id);
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('devis').insert({
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
