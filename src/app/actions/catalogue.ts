'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogueType = 'materiel' | 'service' | 'main_oeuvre' | 'fourniture';
export type CatalogueUnite = 'u' | 'h' | 'j' | 'ml' | 'm2' | 'kg' | 'forfait';

export interface CatalogueItem {
  id:          string;
  ref:         string | null;
  designation: string;
  description: string | null;
  type:        CatalogueType;
  prix_achat:  number;
  prix_vente:  number;
  tva:         number;
  unite:       CatalogueUnite;
  actif:       boolean;
  created_at:  string;
}

export type CatalogueInput = {
  ref:         string;
  designation: string;
  description: string;
  type:        CatalogueType;
  prix_achat:  number;
  prix_vente:  number;
  tva:         number;
  unite:       CatalogueUnite;
  actif:       boolean;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createProduitAction(input: CatalogueInput) {
  const { admin, tenant_id } = await getAuthContext();
  const { error } = await admin
    .from('catalogue')
    .insert({ ...input, tenant_id });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateProduitAction(id: string, input: CatalogueInput) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('catalogue')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteProduitAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('catalogue')
    .delete()
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
