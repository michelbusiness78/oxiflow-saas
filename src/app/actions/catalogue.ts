'use server';
import { translateSupabaseError } from '@/lib/error-messages';

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
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateProduitAction(id: string, input: CatalogueInput) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('catalogue')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteProduitAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('catalogue')
    .delete()
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

export interface ImportProductRow {
  ref:           string;
  designation:   string;
  fournisseur:   string;
  categorie:     string;
  type:          CatalogueType;
  prix_achat:    number | null;
  prix_vente:    number;
  tva:           number;
  unite:         string;
  imported_from: string;
}

const BATCH = 50;

export async function importCatalogueAction(
  products:   ImportProductRow[],
  mode:       'ignore' | 'update',
): Promise<{ imported: number; updated: number; ignored: number; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  // 1. Récupérer les refs existantes pour ce tenant
  const { data: existing, error: fetchErr } = await admin
    .from('catalogue')
    .select('id, ref')
    .eq('tenant_id', tenant_id)
    .not('ref', 'is', null);

  if (fetchErr) return { imported: 0, updated: 0, ignored: 0, error: fetchErr.message };

  const refToId = new Map<string, string>(
    (existing ?? []).map((r) => [r.ref as string, r.id as string]),
  );

  // 2. Séparation nouveaux / doublons
  const toInsert = products.filter((p) => !p.ref || !refToId.has(p.ref));
  const toUpdate = mode === 'update'
    ? products.filter((p) => p.ref && refToId.has(p.ref))
    : [];
  const ignored = mode === 'ignore'
    ? products.filter((p) => p.ref && refToId.has(p.ref)).length
    : 0;

  // 3. Insertions par batch
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map((p) => ({
      ...p,
      tenant_id,
      actif: true,
    }));
    const { error } = await admin.from('catalogue').insert(batch);
    if (error) return { imported, updated: 0, ignored, error: error.message };
    imported += batch.length;
  }

  // 4. Mises à jour des doublons (mode 'update')
  let updated = 0;
  for (const p of toUpdate) {
    const id = refToId.get(p.ref)!;
    const { error } = await admin
      .from('catalogue')
      .update({
        designation:   p.designation,
        fournisseur:   p.fournisseur,
        categorie:     p.categorie,
        prix_achat:    p.prix_achat,
        prix_vente:    p.prix_vente,
        tva:           p.tva,
        unite:         p.unite,
        imported_from: p.imported_from,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', id);
    if (!error) updated++;
  }

  revalidatePath(PATH);
  return { imported, updated, ignored };
}
