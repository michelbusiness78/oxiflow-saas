import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Contexte d'authentification partagé par toutes les server actions.
 *
 * Utilise le client admin pour lire public.users (bypass RLS),
 * évitant le "Profil introuvable" qui bloquait toutes les mutations.
 *
 * Retourne :
 *  - supabase : client régulier (pour auth.getUser uniquement)
 *  - admin    : client service_role (pour toutes les opérations DB)
 *  - user     : auth user
 *  - tenant_id: société de l'utilisateur
 *  - role     : rôle de l'utilisateur
 */
export async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profil introuvable');

  return {
    supabase,
    admin,
    user,
    tenant_id: profile.tenant_id as string,
    role:      profile.role      as string,
  };
}
