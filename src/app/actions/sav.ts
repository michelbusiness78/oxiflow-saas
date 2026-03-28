'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const PATH = '/projets';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Profil introuvable');

  return { supabase, user, tenant_id: profile.tenant_id };
}

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
  const { supabase, tenant_id } = await getAuthContext();

  const { error } = await supabase.from('sav_tickets').insert({
    tenant_id,
    ...input,
    date_ouverture: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateSAVAction(id: string, input: SAVInput) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('sav_tickets').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteSAVAction(id: string) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('sav_tickets').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeSAVStatutAction(
  id: string,
  statut: SAVInput['statut'],
) {
  const { supabase } = await getAuthContext();

  const updates: Record<string, unknown> = { statut };
  if (statut === 'resolu' || statut === 'cloture') {
    updates.date_resolution = new Date().toISOString();
  }

  const { error } = await supabase.from('sav_tickets').update(updates).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
