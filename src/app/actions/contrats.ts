'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

export type ContratInput = {
  client_id:       string;
  type:            'maintenance' | 'support' | 'location';
  date_debut:      string;
  date_fin:        string | null;
  montant_mensuel: number | null;
  actif:           boolean;
};

export async function createContratAction(input: ContratInput) {
  const { admin, tenant_id } = await getAuthContext();
  const { error } = await admin.from('contrats').insert({ ...input, tenant_id });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateContratAction(id: string, input: Partial<ContratInput>) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('contrats').update(input).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteContratAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('contrats').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function toggleContratActifAction(id: string, actif: boolean) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('contrats').update({ actif }).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}
