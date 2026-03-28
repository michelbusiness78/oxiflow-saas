'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const inputCls =
  'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text ' +
  'placeholder:text-oxi-text-muted outline-none transition-colors ' +
  'focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

type Step = 'loading' | 'form' | 'done' | 'error';

export default function SetupPasswordPage() {
  const router  = useRouter();
  const [step,    setStep]    = useState<Step>('loading');
  const [errMsg,  setErrMsg]  = useState('');
  const [pending, setPending] = useState(false);
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');

  // ── Lit les tokens Supabase dans le hash fragment ───────────────────────────
  // Supabase envoie : /auth/setup-password#access_token=xxx&refresh_token=yyy&type=invite
  // Le hash n'est jamais envoyé au serveur → doit être traité côté client.
  useEffect(() => {
    const hash   = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setErrMsg('Lien invalide ou expiré. Demandez une nouvelle invitation au dirigeant.');
      setStep('error');
      return;
    }

    // Établit la session temporaire à partir des tokens de l'invitation
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setErrMsg('Ce lien a déjà été utilisé ou a expiré. Demandez une nouvelle invitation.');
          setStep('error');
        } else {
          setStep('form');
        }
      });
  }, []);

  // ── Soumission du formulaire ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg('');

    if (pwd.length < 8) {
      setErrMsg('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (pwd !== confirm) {
      setErrMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setErrMsg(error.message);
      setPending(false);
      return;
    }

    // Déconnecte immédiatement — l'invité doit se connecter normalement
    await supabase.auth.signOut();
    setStep('done');

    // Redirige vers /login avec un message de confirmation
    setTimeout(() => router.push('/login?activated=1'), 1800);
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-oxi-primary border-t-transparent" />
        <p className="text-sm text-oxi-text-secondary">Vérification du lien…</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-oxi-text">Lien invalide</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errMsg}
        </p>
        <a href="/login" className="block text-center text-sm text-oxi-primary hover:underline">
          Retour à la connexion
        </a>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="space-y-3 text-center py-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-oxi-text">Compte activé !</h2>
        <p className="text-sm text-oxi-text-secondary">Redirection vers la connexion…</p>
      </div>
    );
  }

  // step === 'form'
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-oxi-text">Bienvenue sur OxiFlow</h1>
        <p className="mt-1 text-sm text-oxi-text-secondary">
          Définissez votre mot de passe pour activer votre compte.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-oxi-text">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimum 8 caractères"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-oxi-text">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputCls}
          />
        </div>

        {errMsg && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60"
        >
          {pending ? 'Activation…' : 'Activer mon compte'}
        </button>
      </form>
    </>
  );
}
