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
    return { error: 'Email ou mot de passe incorrect.' };
  }

  redirect(next);
}

// ─── Inscription ──────────────────────────────────────────────────────────────
export async function signUp(_: unknown, formData: FormData) {
  const email     = formData.get('email') as string;
  const password  = formData.get('password') as string;
  const name      = formData.get('name') as string;
  const company   = formData.get('company') as string;

  // 1. Créer le compte Supabase Auth
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Erreur lors de la création du compte.' };
  }

  // 2. Créer le tenant + profil user avec le client admin (bypass RLS)
  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: company, email })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    return { error: 'Erreur lors de la création de votre entreprise.' };
  }

  const { error: userError } = await admin.from('users').insert({
    id:        authData.user.id,
    tenant_id: tenant.id,
    email,
    name,
    role:      'dirigeant',
  });

  if (userError) {
    return { error: 'Erreur lors de la création du profil utilisateur.' };
  }

  // 3. Email de bienvenue (non bloquant)
  try {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);
    const { subject, html } = welcomeEmail(name, trialEndDate);
    await sendEmail(email, subject, html);
  } catch (emailErr) {
    console.error('[signUp] welcome email failed:', emailErr);
  }

  redirect('/pilotage');
}

// ─── Mot de passe oublié ──────────────────────────────────────────────────────
export async function forgotPassword(_: unknown, formData: FormData) {
  const email = formData.get('email') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reset-password`,
  });

  if (error) {
    return { error: 'Impossible d\'envoyer l\'email. Vérifiez l\'adresse saisie.' };
  }

  return { success: 'Un email de réinitialisation a été envoyé.' };
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
