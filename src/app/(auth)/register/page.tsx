'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp } from '@/app/actions/auth';

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, null);

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  const mismatch    = confirm.length > 0 && password !== confirm;
  const submitReady = !pending && !mismatch && password.length >= 8 && confirm.length > 0;

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
