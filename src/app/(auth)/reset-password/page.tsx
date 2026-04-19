'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const inputCls =
  'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text ' +
  'placeholder:text-oxi-text-muted outline-none transition-colors ' +
  'focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const [pending, setPending] = useState(false);
  const [done,    setDone]    = useState(false);

  const mismatch    = confirm.length > 0 && pwd !== confirm;
  const submitReady = !pending && !mismatch && pwd.length >= 8 && confirm.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg('');

    if (pwd.length < 8)  { setErrMsg('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (pwd !== confirm) { setErrMsg('Les mots de passe ne correspondent pas.'); return; }

    setPending(true);
    const { error } = await createClient().auth.updateUser({ password: pwd });
    setPending(false);

    if (error) { setErrMsg(error.message); return; }

    await createClient().auth.signOut();
    setDone(true);
    setTimeout(() => router.push('/login'), 2000);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-oxi-text">Mot de passe mis à jour !</h2>
        <p className="text-sm text-oxi-text-secondary">Vous allez être redirigé vers la connexion…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-oxi-text">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-oxi-text-secondary">
          Choisissez un mot de passe sécurisé pour votre compte.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="pwd" className="block text-sm font-medium text-oxi-text">
            Nouveau mot de passe
          </label>
          <input
            id="pwd" type="password" value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required minLength={8} autoComplete="new-password"
            placeholder="Minimum 8 caractères" className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="block text-sm font-medium text-oxi-text">
            Confirmer le mot de passe
          </label>
          <input
            id="confirm" type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required autoComplete="new-password" placeholder="••••••••"
            className={`${inputCls} ${mismatch ? 'border-oxi-danger focus:border-oxi-danger focus:ring-oxi-danger' : ''}`}
          />
          {mismatch && (
            <p className="text-xs text-oxi-danger">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {errMsg && !mismatch && (
          <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
            {errMsg}
          </div>
        )}

        <button type="submit" disabled={!submitReady}
          className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60 disabled:cursor-not-allowed">
          {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-oxi-text-secondary">
        <Link href="/login" className="font-medium text-oxi-primary hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
    </>
  );
}
