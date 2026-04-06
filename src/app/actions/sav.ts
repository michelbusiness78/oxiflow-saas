'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/chef-projet';
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

  const { data: ticket, error } = await admin.from('sav_tickets').insert(payload).select('id').single();
  if (error) {
    console.error('[createSAVAction] Supabase error:', JSON.stringify(error));
    return { error: translateSupabaseError(error.message) };
  }

  // ── Notification technicien (intervention is_new = true) ──────────────────
  if (input.assigne_a && ticket) {
    try {
      const { data: clientData } = await admin
        .from('clients').select('nom').eq('id', input.client_id).single();
      const clientName = (clientData?.nom as string) ?? '';

      const { data: iv } = await admin.from('interventions').insert({
        tenant_id,
        title:             input.titre || `SAV – ${clientName}`,
        date_start:        new Date().toISOString(),
        status:            'planifiee',
        nature:            'sav',
        type_intervention: 'depannage',
        is_new:            true,
        tech_user_id:      input.assigne_a,
        client_id:         input.client_id,
        client_name:       clientName,
        under_contract:    input.contrat_id ? true : false,
      }).select('id').single();

      if (iv) {
        await admin.from('sav_tickets').update({ intervention_id: iv.id }).eq('id', ticket.id);
      }
    } catch { /* interventions missing columns → skip silently */ }
  }

  revalidatePath(PATH);
  revalidatePath(PATH2);
  return { success: true };
}

export async function updateSAVAction(id: string, input: SAVInput) {
  const { admin, tenant_id } = await getAuthContext();

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

  // ── Notification technicien si assigne_a a changé ────────────────────────────
  try {
    const { data: existing } = await admin
      .from('sav_tickets')
      .select('assigne_a, contrat_id, intervention_id')
      .eq('id', id)
      .single();

    if (existing) {
      const prevAssigne  = (existing.assigne_a    as string | null) ?? null;
      const prevContrat  = (existing.contrat_id   as string | null) ?? null;
      const interventionId = (existing.intervention_id as string | null) ?? null;

      if (input.assigne_a && prevAssigne !== input.assigne_a) {
        // Nouveau technicien → créer une intervention SAV
        const { data: clientData } = await admin
          .from('clients').select('nom').eq('id', input.client_id).single();
        const clientName = (clientData?.nom as string) ?? '';

        const { data: iv } = await admin.from('interventions').insert({
          tenant_id,
          title:             input.titre || `SAV – ${clientName}`,
          date_start:        new Date().toISOString(),
          status:            'planifiee',
          nature:            'sav',
          type_intervention: 'depannage',
          is_new:            true,
          tech_user_id:      input.assigne_a,
          client_id:         input.client_id,
          client_name:       clientName,
          under_contract:    input.contrat_id ? true : false,
        }).select('id').single();

        if (iv) payload.intervention_id = iv.id;
      } else if (interventionId && prevContrat !== input.contrat_id) {
        // Contrat_id modifié → mettre à jour under_contract sur l'intervention liée
        await admin
          .from('interventions')
          .update({ under_contract: input.contrat_id ? true : false })
          .eq('id', interventionId);
      }
    }
  } catch { /* ignore */ }

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
