'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const PATH = '/chef-projet';

export async function assignerTechnicienProjetAction(projetId: string, technicienId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié' };

  // Assigne le technicien à toutes les tâches du projet sans assigné
  const { error } = await supabase
    .from('taches')
    .update({ assigne_a: technicienId })
    .eq('projet_id', projetId)
    .is('assigne_a', null);

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return {};
}
