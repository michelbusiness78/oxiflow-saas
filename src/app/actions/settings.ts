'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const PATH = '/pilotage/parametres';

// ── Auth helper ────────────────────────────────────────────────────────────────

async function getDirigentContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Profil introuvable');
  if (profile.role !== 'dirigeant') throw new Error('Accès refusé');

  return { supabase, user, tenant_id: profile.tenant_id as string };
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
    const { supabase, tenant_id } = await getDirigentContext();
    const { error } = await supabase
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
    const { supabase, tenant_id } = await getDirigentContext();
    const file = formData.get('file') as File | null;
    if (!file) return { error: 'Fichier manquant' };

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${tenant_id}/logo.${ext}`;

    const adminClient = await createAdminClient();
    const { error: uploadError } = await adminClient.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = adminClient.storage
      .from('logos')
      .getPublicUrl(path);

    const logo_url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('tenants').update({ logo_url }).eq('id', tenant_id);
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

export async function inviteUserAction(input: InviteUserInput) {
  try {
    const { tenant_id } = await getDirigentContext();
    const adminClient   = await createAdminClient();

    // Invite via Supabase Auth (envoie l'email de définition de mot de passe)
    const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(
      input.email,
      {
        data:       { name: input.name },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`,
      },
    );
    if (authError) return { error: authError.message };

    // Insert dans la table publique users
    const { error: dbError } = await adminClient
      .from('users')
      .insert({
        id:        authData.user.id,
        tenant_id,
        email:     input.email,
        name:      input.name,
        role:      input.role,
        status:    'active',
      });
    if (dbError) return { error: dbError.message };

    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur invitation' };
  }
}

export async function updateUserRoleAction(userId: string, role: string) {
  try {
    const { supabase } = await getDirigentContext();
    const { error } = await supabase
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
    const { supabase, user } = await getDirigentContext();
    if (userId === user.id) return { error: 'Impossible de modifier votre propre statut' };
    const { error } = await supabase
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
    const { user, supabase } = await getDirigentContext();
    if (userId === user.id) return { error: 'Vous ne pouvez pas vous supprimer vous-même' };

    const adminClient = await createAdminClient();
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) return { error: authError.message };

    // Supprime aussi dans public.users si la FK CASCADE ne le fait pas
    await supabase.from('users').delete().eq('id', userId);

    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur suppression' };
  }
}
