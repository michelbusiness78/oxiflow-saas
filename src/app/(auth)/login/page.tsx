'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/app/actions/auth';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const next      = searchParams.get('next') ?? '/pilotage';
  const activated = searchParams.get('activated') === '1';

  const [state, action, pending] = useActionState(signIn, null);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-oxi-text">Connexion</h1>
        <p className="mt-1 text-sm text-oxi-text-secondary">
          Accédez à votre espace de gestion
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        {activated && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ Compte activé avec succès. Connectez-vous avec votre mot de passe.
          </div>
        )}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-oxi-text">
              Mot de passe
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-oxi-primary hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-oxi-text-secondary">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-oxi-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
