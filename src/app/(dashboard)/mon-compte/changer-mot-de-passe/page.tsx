'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { changePasswordAction } from '@/app/actions/auth';

const inputCls =
  'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text ' +
  'placeholder:text-oxi-text-muted outline-none transition-colors ' +
  'focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

export default function ChangerMotDePassePage() {
  const [state, action] = useFormState(changePasswordAction, null);
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    await action(formData);
    setPending(false);
  }

  const mismatch    = confirm.length > 0 && pwd !== confirm;
  const submitReady = !pending && !mismatch && pwd.length >= 8 && confirm.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Icône cadenas */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-oxi-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-oxi-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
        </div>

        <div className="rounded-xl border border-oxi-border bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-oxi-text">
            Choisissez votre mot de passe
          </h1>
          <p className="mb-6 text-sm text-oxi-text-secondary">
            Pour la sécurité de votre compte, vous devez définir un mot de passe personnel avant de continuer.
          </p>

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-oxi-text">
                Nouveau mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimum 8 caractères"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className={inputCls}
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
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`${inputCls} ${
                  mismatch
                    ? 'border-oxi-danger focus:border-oxi-danger focus:ring-oxi-danger'
                    : ''
                }`}
              />
              {mismatch && (
                <p className="text-xs text-oxi-danger">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            {state?.error && !mismatch && (
              <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={!submitReady}
              className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Enregistrement…' : 'Enregistrer et accéder à mon espace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
