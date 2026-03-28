'use server';

import { createAdminClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Garantit qu'un enregistrement existe dans public.users pour cet auth user.
 * Appelé au début de chaque server action sensible et dans le layout dashboard.
 *
 * Cas couverts :
 * - Compte créé avant la mise en place de la table users (migration manquante)
 * - Compte créé via Supabase Dashboard ou import CSV (pas de trigger)
 * - Premier login après invitation (le trigger a peut-être raté)
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const admin = await createAdminClient();

  // 1. Le profil existe déjà ?
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existing) return; // Rien à faire

  console.log('[ensureUserProfile] Profil manquant pour', user.id, '— création automatique');

  // 2. Cherche un tenant existant lié à cet email
  let tenantId: string | null = null;

  const { data: tenantByEmail } = await admin
    .from('tenants')
    .select('id')
    .eq('email', user.email ?? '')
    .single();

  if (tenantByEmail) {
    tenantId = tenantByEmail.id;
  } else {
    // 3. Crée un tenant minimal
    const companyName =
      (user.user_metadata?.company as string | undefined) ??
      (user.user_metadata?.name  as string | undefined) ??
      user.email?.split('@')[1] ??
      'Ma société';

    const { data: newTenant } = await admin
      .from('tenants')
      .insert({ name: companyName, email: user.email })
      .select('id')
      .single();

    tenantId = newTenant?.id ?? null;
  }

  if (!tenantId) {
    console.error('[ensureUserProfile] Impossible de trouver ou créer un tenant pour', user.id);
    return;
  }

  // 4. Crée le profil utilisateur
  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Utilisateur';

  const { error } = await admin.from('users').insert({
    id:        user.id,
    tenant_id: tenantId,
    email:     user.email,
    name,
    role:      'dirigeant',
    status:    'active',
  });

  if (error) {
    console.error('[ensureUserProfile] Erreur insert:', error.message);
  } else {
    console.log('[ensureUserProfile] Profil créé avec tenant_id', tenantId);
  }
}
