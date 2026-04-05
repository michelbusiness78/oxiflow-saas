'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/projets';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SAVInput = {
  client_id:       string;
  titre:           string;
  description:     string;
  priorite:        'faible' | 'normale' | 'haute' | 'urgente';
  statut:          'ouvert' | 'en_cours' | 'resolu' | 'cloture';
  contrat_id:      string | null;
  assigne_a:       string | null;
  date_resolution: string | null;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createSAVAction(input: SAVInput) {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin.from('sav_tickets').insert({
    tenant_id,
    ...input,
    date_ouverture: new Date().toISOString(),
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateSAVAction(id: string, input: SAVInput) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('sav_tickets').update(input).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteSAVAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('sav_tickets').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeSAVStatutAction(
  id: string,
  statut: SAVInput['statut'],
) {
  const { admin } = await getAuthContext();

  const updates: Record<string, unknown> = { statut };
  if (statut === 'resolu' || statut === 'cloture') {
    updates.date_resolution = new Date().toISOString();
  }

  const { error } = await admin.from('sav_tickets').update(updates).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}
