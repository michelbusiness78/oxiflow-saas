'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const PATH = '/commerce';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');
  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error('Profil introuvable');
  return { supabase, user, tenant_id: profile.tenant_id };
}

export type ContratInput = {
  client_id:       string;
  type:            'maintenance' | 'support' | 'location';
  date_debut:      string;
  date_fin:        string | null;
  montant_mensuel: number | null;
  actif:           boolean;
};

export async function createContratAction(input: ContratInput) {
  const { supabase, tenant_id } = await getAuthContext();
  const { error } = await supabase.from('contrats').insert({ ...input, tenant_id });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateContratAction(id: string, input: Partial<ContratInput>) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('contrats').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteContratAction(id: string) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('contrats').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function toggleContratActifAction(id: string, actif: boolean) {
  const { supabase } = await getAuthContext();
  const { error } = await supabase.from('contrats').update({ actif }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
