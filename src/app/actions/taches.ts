'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH       = '/projets';
const PATH_CHEF  = '/chef-projet';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TacheInput = {
  projet_id:      string | null;
  titre:          string;
  description:    string | null;
  assigne_a:      string | null;
  priorite:       'faible' | 'normale' | 'haute' | 'urgente';
  etat:           'a_faire' | 'en_cours' | 'en_review' | 'terminee';
  date_echeance:  string | null;
  pct_avancement: number;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTacheAction(input: TacheInput) {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin.from('taches').insert({ tenant_id, ...input });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath(PATH_CHEF);
  return { success: true };
}

export async function updateTacheAction(id: string, input: TacheInput) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('taches').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath(PATH_CHEF);
  return { success: true };
}

export async function deleteTacheAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('taches').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath(PATH_CHEF);
  return { success: true };
}

export async function changeTacheEtatAction(
  id: string,
  etat: TacheInput['etat'],
) {
  const { admin } = await getAuthContext();

  const pct = etat === 'terminee' ? 100 : etat === 'en_cours' ? 50 : 0;
  const { error } = await admin
    .from('taches')
    .update({ etat, pct_avancement: pct })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath(PATH_CHEF);
  return { success: true };
}
