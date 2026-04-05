'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/projets';
const PATH2 = '/chef-projet';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SAVInput = {
  client_id:         string;
  titre:             string;
  description:       string;
  priorite:          'faible' | 'normale' | 'haute' | 'urgente';
  statut:            'ouvert' | 'en_cours' | 'resolu' | 'cloture';
  contrat_id:        string | null;
  assigne_a:         string | null;
  date_resolution:   string | null;
  project_id?:       string | null;
  resolution_notes?: string | null;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createSAVAction(input: SAVInput) {
  const { admin, tenant_id } = await getAuthContext();

  // Colonnes de base — toujours présentes
  const payload: Record<string, unknown> = {
    tenant_id,
    client_id:       input.client_id,
    titre:           input.titre,
    description:     input.description,
    priorite:        input.priorite,
    statut:          input.statut,
    contrat_id:      input.contrat_id,
    assigne_a:       input.assigne_a,
    date_resolution: input.date_resolution,
    date_ouverture:  new Date().toISOString(),
  };

  // Colonnes optionnelles ajoutées en migration 021 — uniquement si valeur non nulle
  // (évite une erreur "column does not exist" si la migration n'a pas encore été exécutée)
  if (input.project_id)       payload.project_id       = input.project_id;
  if (input.resolution_notes) payload.resolution_notes = input.resolution_notes;

  const { error } = await admin.from('sav_tickets').insert(payload);
  if (error) {
    console.error('[createSAVAction] Supabase error:', JSON.stringify(error));
    return { error: translateSupabaseError(error.message) };
  }
  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}

export async function updateSAVAction(id: string, input: SAVInput) {
  const { admin } = await getAuthContext();

  const payload: Record<string, unknown> = {
    client_id:       input.client_id,
    titre:           input.titre,
    description:     input.description,
    priorite:        input.priorite,
    statut:          input.statut,
    contrat_id:      input.contrat_id,
    assigne_a:       input.assigne_a,
    date_resolution: input.date_resolution,
  };

  if (input.project_id       !== undefined) payload.project_id       = input.project_id       ?? null;
  if (input.resolution_notes !== undefined) payload.resolution_notes = input.resolution_notes ?? null;

  const { error } = await admin.from('sav_tickets').update(payload).eq('id', id);
  if (error) {
    console.error('[updateSAVAction] Supabase error:', JSON.stringify(error));
    return { error: translateSupabaseError(error.message) };
  }
  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}

export async function deleteSAVAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('sav_tickets').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}

export async function changeSAVStatutAction(
  id:               string,
  statut:           SAVInput['statut'],
  resolutionNotes?: string | null,
) {
  const { admin } = await getAuthContext();

  const updates: Record<string, unknown> = { statut };
  if (statut === 'resolu' || statut === 'cloture') {
    updates.date_resolution = new Date().toISOString();
    if (resolutionNotes !== undefined) updates.resolution_notes = resolutionNotes;
  }

  const { error } = await admin.from('sav_tickets').update(updates).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}
