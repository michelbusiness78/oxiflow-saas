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

  // ── Colonnes garanties (migration 001) ──────────────────────────────────────
  const payload: Record<string, unknown> = {
    tenant_id,
    client_id:       input.client_id,
    description:     input.description,
    priorite:        input.priorite,
    statut:          input.statut,
    contrat_id:      input.contrat_id,
    date_ouverture:  new Date().toISOString(),
  };

  // ── Colonnes optionnelles (migration 022) — incluses uniquement si elles ont une valeur ──
  // Cela évite l'erreur PostgREST "column does not exist" tant que la migration n'est pas appliquée.
  if (input.titre)             payload.titre             = input.titre;
  if (input.assigne_a)         payload.assigne_a         = input.assigne_a;
  if (input.project_id)        payload.project_id        = input.project_id;
  if (input.resolution_notes)  payload.resolution_notes  = input.resolution_notes;

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

  // ── Colonnes garanties ───────────────────────────────────────────────────────
  const payload: Record<string, unknown> = {
    client_id:    input.client_id,
    description:  input.description,
    priorite:     input.priorite,
    statut:       input.statut,
    contrat_id:   input.contrat_id,
  };

  // ── Colonnes optionnelles (migration 022) ────────────────────────────────────
  if (input.titre            !== undefined) payload.titre            = input.titre            ?? null;
  if (input.assigne_a        !== undefined) payload.assigne_a        = input.assigne_a        ?? null;
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
    // resolution_notes : colonne optionnelle (migration 022)
    if (resolutionNotes) updates.resolution_notes = resolutionNotes;
  }

  const { error } = await admin.from('sav_tickets').update(updates).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}
