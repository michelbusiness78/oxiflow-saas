'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// ── Styles réutilisés depuis login/setup-password ─────────────────────────────
const inputCls =
  'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text ' +
  'placeholder:text-oxi-text-muted outline-none transition-colors ' +
  'focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

type Step = 'loading' | 'form' | 'done' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [step,    setStep]    = useState<Step>('loading');
  const [errMsg,  setErrMsg]  = useState('');
  const [pending, setPending] = useState(false);
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');

  // ── Lecture des tokens dans le hash fragment ──────────────────────────────────
  // Supabase redirige vers : /reset-password#access_token=…&type=recovery
  // Le hash n'est JAMAIS envoyé au serveur → traitement client uniquement.
  useEffect(() => {
    const hash   = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');

    if (!accessToken || !refreshToken) {
      setErrMsg('Lien invalide ou expiré. Veuillez faire une nouvelle demande de réinitialisation.');
      setStep('error');
      return;
    }

    if (type !== 'recovery') {
      setErrMsg('Ce lien n\'est pas un lien de réinitialisation de mot de passe.');
      setStep('error');
      return;
    }

    // Établit la session temporaire à partir des tokens du lien email
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setErrMsg('Ce lien a déjà été utilisé ou a expiré. Veuillez faire une nouvelle demande.');
          setStep('error');
        } else {
          setStep('form');
        }
      });
  }, []);

  // ── Soumission du nouveau mot de passe ────────────────────────────────────────
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

    // Déconnexion propre — l'utilisateur doit se reconnecter normalement
    await supabase.auth.signOut();
    setStep('done');
    setTimeout(() => router.push('/login'), 2000);
  }

  const mismatch    = confirm.length > 0 && pwd !== confirm;
  const submitReady = !pending && !mismatch && pwd.length >= 8 && confirm.length > 0;

  // ── Rendu ─────────────────────────────────────────────────────────────────────

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
      <div className="space-y-5">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-oxi-text">Lien invalide</h1>
          <p className="mt-1 text-sm text-oxi-text-secondary">
            Le lien de réinitialisation est expiré ou déjà utilisé.
          </p>
        </div>
        <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
          {errMsg}
        </div>
        <Link
          href="/forgot-password"
          className="block w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover"
        >
          Faire une nouvelle demande
        </Link>
        <p className="text-center text-sm text-oxi-text-secondary">
          <Link href="/login" className="font-medium text-oxi-primary hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-oxi-text">Mot de passe mis à jour !</h2>
        <p className="text-sm text-oxi-text-secondary">
          Vous allez être redirigé vers la connexion…
        </p>
      </div>
    );
  }

  // step === 'form'
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
            id="pwd"
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
          <label htmlFor="confirm" className="block text-sm font-medium text-oxi-text">
            Confirmer le mot de passe
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
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

        {errMsg && !mismatch && (
          <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
            {errMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!submitReady}
          className="mt-2 w-full rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxi-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
        >
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
