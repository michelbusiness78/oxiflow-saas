'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogueType =
  | 'materiel'
  | 'service'
  | 'forfait'
  | 'main_oeuvre'
  | 'fourniture';

export interface CatalogueItem {
  id:            string;
  ref:           string | null;
  designation:   string;
  description:   string | null;
  fournisseur:   string | null;
  categorie:     string | null;
  type:          CatalogueType;
  prix_achat:    number | null;
  prix_vente:    number;
  tva:           number;
  unite:         string;
  actif:         boolean;
  imported_from: string | null;
  created_at:    string;
}

export type CatalogueInput = {
  ref:         string;
  designation: string;
  description: string;
  fournisseur: string;
  categorie:   string;
  type:        CatalogueType;
  prix_achat:  number | null;
  prix_vente:  number;
  tva:         number;
  unite:       string;
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
