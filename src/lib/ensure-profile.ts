'use server';

import { createAdminClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Garantit qu'un enregistrement existe dans public.users UNIQUEMENT pour un
 * dirigeant inscrit via /register (user_metadata.company présent).
 *
 * Pour les utilisateurs invités, leur profil est inséré par inviteUserAction.
 * Si ce profil est absent, c'est une erreur d'invitation : on logue sans créer
 * de faux tenant, pour ne pas mélanger les données entre entreprises.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const admin = await createAdminClient();

  // Profil existe déjà → rien à faire (cas normal à chaque connexion)
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) return;

  // Pas de profil. On ne crée automatiquement que pour un dirigeant /register,
  // reconnaissable par la présence de `company` dans user_metadata.
  const company = user.user_metadata?.company as string | undefined;
  if (!company) {
    console.error(
      '[ensureUserProfile] Invité sans profil public.users — vérifier inviteUserAction :',
      user.id, user.email,
    );
    return; // Ne pas créer de faux tenant pour un invité
  }

  console.log('[ensureUserProfile] Dirigeant sans profil → création auto :', user.email);

  // Cherche ou crée un tenant pour ce dirigeant
  let tenantId: string | null = null;

  const { data: tenantByEmail } = await admin
    .from('tenants')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (tenantByEmail) {
    tenantId = tenantByEmail.id;
  } else {
    const { data: newTenant } = await admin
      .from('tenants')
      .insert({ name: company, email: user.email })
      .select('id')
      .single();
    tenantId = newTenant?.id ?? null;
  }

  if (!tenantId) {
    console.error('[ensureUserProfile] Impossible de trouver/créer le tenant pour', user.id);
    return;
  }

  const name = (user.user_metadata?.name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? 'Utilisateur';

  const { error } = await admin.from('users').insert({
    id:        user.id,
    tenant_id: tenantId,
    email:     user.email,
    name,
    role:      'dirigeant',
    status:    'active',
  });

  if (error) console.error('[ensureUserProfile] Erreur insert:', error.message);
}
