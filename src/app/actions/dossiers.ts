'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext }  from '@/lib/auth-context';

const PATH = '/chef-projet';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DossierInput {
  client_id:   string;
  type_projet: string | null;
  statut:      string;
  notes:       string | null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createDossierAction(input: DossierInput) {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin.from('dossiers').insert({
    tenant_id,
    client_id:   input.client_id,
    type_projet: input.type_projet || null,
    statut:      input.statut,
    notes:       input.notes       || null,
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteDossierAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('dossiers').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}
