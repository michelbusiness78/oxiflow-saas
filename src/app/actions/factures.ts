'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';
import type { DevisLigne } from './commerce';

const PATH = '/commerce';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextFactureNum(admin: any, tenant_id: string): Promise<string> {
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
  const { admin, tenant_id } = await getAuthContext();
  const num = await nextFactureNum(admin, tenant_id);
  const { error } = await admin.from('factures').insert({
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
  const { admin } = await getAuthContext();
  const { error } = await admin.from('factures').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteFactureAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('factures').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeFactureStatutAction(
  id: string,
  statut: 'brouillon' | 'envoyee' | 'payee' | 'partielle' | 'impayee',
) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('factures').update({ statut }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// Créer un avoir = nouvelle facture avec montants négatifs
export async function creerAvoirAction(id: string) {
  const { admin, tenant_id } = await getAuthContext();
  const { data: original, error: fetchErr } = await admin
    .from('factures').select('*').eq('id', id).single();
  if (fetchErr || !original) return { error: 'Facture introuvable.' };

  const num = await nextFactureNum(admin, tenant_id);
  const today = new Date().toISOString().split('T')[0];

  const avoirLignes = (original.lignes as DevisLigne[]).map((l) => ({
    ...l,
    prix_ht: -Math.abs(l.prix_ht),
  }));

  const { error } = await admin.from('factures').insert({
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
