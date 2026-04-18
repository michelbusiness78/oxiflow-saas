'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { useActionState, useState } from 'react';
import { signUp, resendConfirmationEmail } from '@/app/actions/auth';

// ─── Écran de confirmation email ──────────────────────────────────────────────
function VerifyEmailScreen({ email }: { email: string }) {
  const [resendState, resendAction, resendPending] = useFormState(
    resendConfirmationEmail,
    null,
  );

  return (
    <div className="flex flex-col items-center text-center">
      {/* Icône enveloppe */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-oxi-primary/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-oxi-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-oxi-text">
        Vérifiez votre boîte mail
      </h1>

      <p className="mt-3 text-sm text-oxi-text-secondary leading-relaxed">
        Un email de confirmation a été envoyé à{' '}
        <span className="font-medium text-oxi-text">{email}</span>.
        <br />
        Cliquez sur le lien dans l&apos;email pour activer votre compte.
      </p>

      {/* Feedback renvoi */}
      {resendState?.success && (
        <div className="mt-4 w-full rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ {resendState.success}
        </div>
      )}
      {resendState?.error && (
        <div className="mt-4 w-full rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
          {resendState.error}
        </div>
      )}

      {/* Renvoi email */}
      <p className="mt-5 text-sm text-oxi-text-muted">
        Vous n&apos;avez pas reçu l&apos;email ? Vérifiez vos spams ou{' '}
        <form action={resendAction} className="inline">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resendPending}
            className="font-medium text-oxi-primary hover:underline disabled:opacity-60"
          >
            {resendPending ? 'Envoi…' : 'renvoyer l\'email de confirmation'}
          </button>
        </form>
      </p>

      <Link
        href="/login"
        className="mt-6 w-full rounded-lg border border-oxi-border bg-transparent px-4 py-2.5 text-center text-sm font-medium text-oxi-text transition-colors hover:bg-oxi-bg"
      >
        Retour à la connexion
      </Link>
    </div>
  );
}

// ─── Formulaire d'inscription ──────────────────────────────────────────────────
export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, null);

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  const mismatch    = confirm.length > 0 && password !== confirm;
  const submitReady = !pending && !mismatch && password.length >= 8 && confirm.length > 0;

  // Inscription réussie → écran de confirmation
  if (state?.success) {
    return <VerifyEmailScreen email={state.email} />;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-oxi-text">Créer un compte</h1>
        <p className="mt-1 text-sm text-oxi-text-secondary">
          Démarrez votre essai gratuit en 30 secondes
        </p>
      </div>

      <form action={action} className="space-y-4">
        {state?.error && (
          <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-oxi-text">
            Votre nom
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jean Dupont"
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="company" className="block text-sm font-medium text-oxi-text">
            Nom de la société
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            placeholder="Ma Société SARL"
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-oxi-text">
            Email professionnel
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@entreprise.fr"
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-oxi-text">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-sm font-medium text-oxi-text">
            Confirmer le mot de passe
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Répétez votre mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`w-full rounded-lg border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:ring-1 ${
              mismatch
                ? 'border-oxi-danger focus:border-oxi-danger focus:ring-oxi-danger'
                : 'border-oxi-border focus:border-oxi-primary focus:ring-oxi-primary'
            }`}
          />
          {mismatch && (
            <p className="text-xs text-oxi-danger">
              Les mots de passe ne correspondent pas.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!submitReady}
          className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Création…' : 'Créer mon compte'}
        </button>

        <p className="text-center text-xs text-oxi-text-muted">
          En créant un compte, vous acceptez nos{' '}
          <Link href="/cgv" className="text-oxi-text-secondary hover:underline">
            conditions d&apos;utilisation
          </Link>.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-oxi-text-secondary">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-oxi-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
