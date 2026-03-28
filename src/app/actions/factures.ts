'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { DevisLigne } from './commerce';

const PATH = '/commerce';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');
  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error('Profil introuvable');
  return { supabase, user, tenant_id: profile.tenant_id };
}

async function nextFactureNum(tenant_id: string): Promise<string> {
  const admin = await createAdminClient();
  const { count } = await admin
    .from('factures')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);
  return `FACT-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

export type FactureInput = {
  client_id:   string;
  devis_id?:   string | null;
  date:        string;
  echeance:    string;
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
  statut:      'brouillon' | 'envoyee';
};

export async function createFactureAction(input: FactureInput) {
  const { supabase, tenant_id } = await getAuthContext();
  const num = await nextFactureNum(tenant_id);
  const { error } = await supabase.from('factures').insert({
    ...input,
    num,
    tenant_id,
    devis_id: input.devis_id || null,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateFactureAction(id: string, input: Partial<FactureInput>) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('factures').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteFactureAction(id: string) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('factures').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeFactureStatutAction(
  id: string,
  statut: 'brouillon' | 'envoyee' | 'payee' | 'partielle' | 'impayee',
) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('factures').update({ statut }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// Créer un avoir = nouvelle facture avec montants négatifs
export async function creerAvoirAction(id: string) {
  const { supabase, tenant_id } = await getAuthContext();
  const { data: original, error: fetchErr } = await supabase
    .from('factures').select('*').eq('id', id).single();
  if (fetchErr || !original) return { error: 'Facture introuvable.' };

  const num = await nextFactureNum(tenant_id);
  const today = new Date().toISOString().split('T')[0];

  const avoirLignes = (original.lignes as DevisLigne[]).map((l) => ({
    ...l,
    prix_ht: -Math.abs(l.prix_ht),
  }));

  const { error } = await supabase.from('factures').insert({
    tenant_id,
    client_id:   original.client_id,
    devis_id:    original.devis_id,
    num,
    date:        today,
    echeance:    today,
    statut:      'envoyee',
    lignes:      avoirLignes,
    montant_ht:  -Math.abs(original.montant_ht),
    tva:         -Math.abs(original.tva),
    montant_ttc: -Math.abs(original.montant_ttc),
  });

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
