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
  const { supabase, tenant_id } = await getAuthContext();

  const { error } = await supabase.from('taches').insert({ tenant_id, ...input });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateTacheAction(id: string, input: TacheInput) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('taches').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteTacheAction(id: string) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('taches').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeTacheEtatAction(
  id: string,
  etat: TacheInput['etat'],
) {
  const { supabase } = await getAuthContext();

  const pct = etat === 'terminee' ? 100 : etat === 'en_cours' ? 50 : 0;
  const { error } = await supabase
    .from('taches')
    .update({ etat, pct_avancement: pct })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
