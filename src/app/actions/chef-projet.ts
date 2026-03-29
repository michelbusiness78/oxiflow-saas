'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/chef-projet';

export async function assignerTechnicienProjetAction(projetId: string, technicienId: string) {
  const { admin } = await getAuthContext();

  // Assigne le technicien à toutes les tâches du projet sans assigné
  const { error } = await admin
    .from('taches')
    .update({ assigne_a: technicienId })
    .eq('projet_id', projetId)
    .is('assigne_a', null);

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return {};
}
