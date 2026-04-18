'use server';

import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { welcomeEmail } from '@/lib/email-templates';

// ─── Connexion ────────────────────────────────────────────────────────────────
export async function signIn(_: unknown, formData: FormData) {
  const email    = formData.get('email') as string;
  const password = formData.get('password') as string;
  const next     = (formData.get('next') as string) || '/pilotage';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isEmailNotConfirmed =
      error.code === 'email_not_confirmed' ||
      error.message?.toLowerCase().includes('email not confirmed');

    if (isEmailNotConfirmed) {
      return {
        error: 'Votre adresse email n\'est pas encore confirmée. Vérifiez vos spams ou',
        emailNotConfirmed: true as const,
        email,
      };
    }

    return { error: 'Adresse email ou mot de passe incorrect.' };
  }

  redirect(next);
}

// ─── Renvoi email de confirmation ─────────────────────────────────────────────
export async function resendConfirmationEmail(_: unknown, formData: FormData) {
  const email = formData.get('email') as string;

  if (!email) return { error: 'Email manquant.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.resend({ type: 'signup', email });

  if (error) {
    console.error('[resendConfirmationEmail] error:', error.message);
    return { error: 'Impossible de renvoyer l\'email. Réessayez dans quelques instants.' };
  }

  return { success: 'Email renvoyé !' };
}

// ─── Inscription ──────────────────────────────────────────────────────────────
export async function signUp(_: unknown, formData: FormData) {
  const email     = formData.get('email') as string;
  const password  = formData.get('password') as string;
  const name      = formData.get('name') as string;
  const company   = formData.get('company') as string;

  const admin  = createAdminClient();

  // 0. Vérifie si un profil existe déjà pour cet email (inscription précédente avortée)
  const { data: existingUser } = await admin
    .from('users')
    .select('id, tenant_id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    // Un profil orphelin existe — on retourne une erreur explicite
    console.error('[signUp] email already in public.users:', email);
    return { error: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez "Mot de passe oublié".' };
  }

  // 1. Créer le compte Supabase Auth
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://oxiflow.fr';
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data:            { name },
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (authError || !authData.user) {
    console.error('[signUp] auth.signUp error:', authError?.message, authError?.status);
    return { error: authError?.message ?? 'Erreur lors de la création du compte.' };
  }

  const authUserId = authData.user.id;

  // 2. Créer le tenant (bypass RLS via admin)
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: company, email })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    console.error('[signUp] tenant insert error — code:', tenantError?.code, '| message:', tenantError?.message, '| details:', tenantError?.details);
    // Nettoie l'utilisateur Auth pour éviter un compte zombie sans profil
    await admin.auth.admin.deleteUser(authUserId);
    return { error: 'Erreur lors de la création de votre entreprise. Veuillez réessayer.' };
  }

  // 3. Créer le profil utilisateur lié au tenant
  const { error: userError } = await admin.from('users').insert({
    id:        authUserId,
    tenant_id: tenant.id,
    email,
    name,
    role:      'dirigeant',
  });

  if (userError) {
    console.error('[signUp] user insert error — code:', userError.code, '| message:', userError.message, '| details:', userError.details, '| hint:', userError.hint);
    // Nettoie le tenant orphelin et l'utilisateur Auth
    await admin.from('tenants').delete().eq('id', tenant.id);
    await admin.auth.admin.deleteUser(authUserId);
    return { error: 'Erreur lors de la création du profil. Veuillez réessayer.' };
  }

  // 4. Email de bienvenue (non bloquant)
  try {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);
    const { subject, html } = welcomeEmail(name, trialEndDate);
    await sendEmail(email, subject, html);
  } catch (emailErr) {
    console.error('[signUp] welcome email failed:', emailErr);
  }

  return { success: true as const, email };
}

// ─── Mot de passe oublié ──────────────────────────────────────────────────────
export async function forgotPassword(_: unknown, formData: FormData) {
  const email = formData.get('email') as string;

  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || 'https://oxiflow.fr';
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  if (error) {
    return { error: 'Impossible d\'envoyer l\'email. Vérifiez l\'adresse saisie.' };
  }

  return { success: 'Un email de réinitialisation a été envoyé.' };
}

// ─── Changement de mot de passe obligatoire (première connexion) ──────────────
export async function changePasswordAction(_: unknown, formData: FormData) {
  const password = formData.get('password') as string;

  if (!password || password.length < 8) {
    return { error: 'Le mot de passe doit faire au moins 8 caractères.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  // Efface le flag — accès admin pour bypass RLS
  const admin = createAdminClient();
  await admin.from('users').update({ must_change_password: false }).eq('id', user.id);

  // Redirige vers la première page accessible selon le rôle
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const roleHome: Record<string, string> = {
    technicien:  '/technicien',
    commercial:  '/commerce',
    chef_projet: '/chef-projet',
    rh:          '/rh',
  };
  redirect(roleHome[profile?.role ?? ''] ?? '/pilotage');
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
