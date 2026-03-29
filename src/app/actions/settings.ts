'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/ensure-profile';

const PATH = '/pilotage/parametres';

// ── Auth helper ────────────────────────────────────────────────────────────────

async function getDirigentContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  // Garantit l'existence du profil (crée si absent — ex: compte créé hors signup)
  await ensureUserProfile(user);

  // Admin client pour bypass RLS sur la table users
  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Profil introuvable après création automatique');
  if (profile.role !== 'dirigeant') throw new Error('Accès refusé');

  return { supabase, admin, user, tenant_id: profile.tenant_id as string };
}

// ── SOCIÉTÉ ────────────────────────────────────────────────────────────────────

export type SocieteInput = {
  name:                string;
  siret:               string;
  tva_intra:           string;
  address:             string;
  cp:                  string;
  ville:               string;
  phone:               string;
  email:               string;
  iban:                string;
  bic:                 string;
  conditions_paiement: string;
  mentions_legales:    string;
};

export async function updateSocieteAction(input: SocieteInput) {
  try {
    const { admin, tenant_id } = await getDirigentContext();
    const { error } = await admin
      .from('tenants')
      .update(input)
      .eq('id', tenant_id);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export async function uploadLogoAction(formData: FormData) {
  try {
    const { admin, tenant_id } = await getDirigentContext();
    const file = formData.get('file') as File | null;
    if (!file) return { error: 'Fichier manquant' };

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${tenant_id}/logo.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = admin.storage
      .from('logos')
      .getPublicUrl(path);

    const logo_url = `${publicUrl}?t=${Date.now()}`;
    await admin.from('tenants').update({ logo_url }).eq('id', tenant_id);
    revalidatePath(PATH);
    return { success: true, logo_url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur upload' };
  }
}

// ── UTILISATEURS ───────────────────────────────────────────────────────────────

export type InviteUserInput = {
  email: string;
  name:  string;
  role:  'commercial' | 'technicien' | 'chef_projet' | 'rh';
};

// Génère un mot de passe temporaire lisible (12 chars, sans ambiguïté 0/O/l/1)
function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export async function inviteUserAction(input: InviteUserInput) {
  try {
    const { admin, tenant_id } = await getDirigentContext();
    const tempPassword = generateTempPassword();

    // Crée le compte directement (email_confirm: true = skip confirmation)
    // NE PAS utiliser inviteUserByEmail : il crée une session automatique côté browser
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email:          input.email,
      password:       tempPassword,
      email_confirm:  true,
      user_metadata:  { name: input.name, must_change_password: true },
    });
    if (authError) return { error: authError.message };

    // Insert dans la table publique users
    const { error: dbError } = await admin
      .from('users')
      .insert({
        id:        authData.user.id,
        tenant_id,
        email:     input.email,
        name:      input.name,
        role:      input.role,
        status:    'active',
      });
    if (dbError) {
      // Rollback auth user si insert échoue
      await admin.auth.admin.deleteUser(authData.user.id);
      return { error: dbError.message };
    }

    revalidatePath(PATH);
    // Le mot de passe temporaire est renvoyé pour que le dirigeant puisse le communiquer
    return { success: true, tempPassword };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur invitation' };
  }
}

export async function updateUserRoleAction(userId: string, role: string) {
  try {
    const { admin } = await getDirigentContext();
    const { error } = await admin
      .from('users')
      .update({ role })
      .eq('id', userId);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}

export async function toggleUserStatusAction(userId: string, status: 'active' | 'inactive') {
  try {
    const { admin, user } = await getDirigentContext();
    if (userId === user.id) return { error: 'Impossible de modifier votre propre statut' };
    const { error } = await admin
      .from('users')
      .update({ status })
      .eq('id', userId);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur' };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const { admin, user } = await getDirigentContext();
    if (userId === user.id) return { error: 'Vous ne pouvez pas vous supprimer vous-même' };

    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) return { error: authError.message };

    // Supprime aussi dans public.users si la FK CASCADE ne le fait pas
    await admin.from('users').delete().eq('id', userId);

    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression' };
  }
}
