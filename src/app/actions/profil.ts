'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// ── Mise à jour du nom ─────────────────────────────────────────────────────────

export async function updateNameAction(name: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom ne peut pas être vide.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  // Mise à jour dans users (admin pour bypass RLS)
  try {
    const admin = await createAdminClient();
    const { error } = await admin
      .from('users')
      .update({ name: trimmed })
      .eq('id', user.id);
    if (error) return { error: error.message };
  } catch {
    // Fallback client régulier
    const { error } = await supabase
      .from('users')
      .update({ name: trimmed })
      .eq('id', user.id);
    if (error) return { error: error.message };
  }

  revalidatePath('/profil');
  revalidatePath('/pilotage', 'layout');
  return {};
}

// ── Changement de mot de passe ─────────────────────────────────────────────────

export async function updatePasswordAction(
  oldPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  if (newPassword.length < 8) {
    return { error: 'Le mot de passe doit faire au moins 8 caractères.' };
  }

  const supabase = await createClient();

  // Vérifier l'ancien mot de passe via une re-authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Non authentifié.' };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  });
  if (signInError) return { error: 'Mot de passe actuel incorrect.' };

  // Mise à jour du mot de passe + efface le flag must_change_password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });
  if (error) return { error: error.message };

  revalidatePath('/profil');
  revalidatePath('/pilotage', 'layout');
  return {};
}
