'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPassword } from '@/app/actions/auth';

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPassword, null);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-oxi-text">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-oxi-text-secondary">
          Entrez votre email pour recevoir un lien de réinitialisation.
        </p>
      </div>

      {state?.success ? (
        <div className="rounded-lg bg-oxi-success-light px-4 py-4 text-sm text-oxi-success">
          <p className="font-medium">Email envoyé !</p>
          <p className="mt-1">{state.success}</p>
          <Link
            href="/login"
            className="mt-3 inline-block text-oxi-primary hover:underline"
          >
            ← Retour à la connexion
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          {state?.error && (
            <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-oxi-text">
              Email
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

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60"
          >
            {pending ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}

      {!state?.success && (
        <p className="mt-6 text-center text-sm text-oxi-text-secondary">
          <Link href="/login" className="font-medium text-oxi-primary hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      )}
    </>
  );
}
