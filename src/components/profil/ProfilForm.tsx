'use client';

import { useState, useTransition } from 'react';
import { updateNameAction, updatePasswordAction } from '@/app/actions/profil';

const ROLE_COLORS: Record<string, string> = {
  dirigeant:   'bg-blue-100 text-blue-700',
  commercial:  'bg-green-100 text-green-700',
  technicien:  'bg-yellow-100 text-yellow-700',
  chef_projet: 'bg-purple-100 text-purple-700',
  rh:          'bg-pink-100 text-pink-700',
};

const ROLE_LABELS: Record<string, string> = {
  dirigeant:   'Dirigeant',
  commercial:  'Commercial',
  technicien:  'Technicien',
  chef_projet: 'Chef Projet',
  rh:          'RH',
};

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60';

interface Props {
  name:  string;
  email: string;
  role:  string;
}

export function ProfilForm({ name: initialName, email, role }: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName]            = useState(initialName);

  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError,   setNameError]   = useState('');

  const [oldPwd,     setOldPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError,   setPwdError]   = useState('');

  // ── Nom ──────────────────────────────────────────────────────────────────────

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameSuccess(false);
    setNameError('');
    startTransition(async () => {
      const res = await updateNameAction(name);
      if (res.error) { setNameError(res.error); return; }
      setNameSuccess(true);
    });
  }

  // ── Mot de passe ─────────────────────────────────────────────────────────────

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwdSuccess(false);
    setPwdError('');
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return; }
    startTransition(async () => {
      const res = await updatePasswordAction(oldPwd, newPwd);
      if (res.error) { setPwdError(res.error); return; }
      setPwdSuccess(true);
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Avatar + infos ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-xl font-semibold text-blue-600">
          {initials || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-800 truncate">{name}</p>
          <p className="text-sm text-slate-400 truncate">{email}</p>
          <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      </div>

      {/* ── Informations générales ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-3">
          Informations générales
        </h2>
        <form onSubmit={handleNameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom complet</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameSuccess(false); }}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input value={email} disabled className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">L'email ne peut pas être modifié ici.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rôle</label>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
              {ROLE_LABELS[role] ?? role}
            </span>
          </div>
          {nameError   && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{nameError}</p>}
          {nameSuccess && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">✓ Nom mis à jour.</p>}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Changer le mot de passe ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-3">
          Changer le mot de passe
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mot de passe actuel</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              required
              autoComplete="current-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">Minimum 8 caractères.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          {pwdError   && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{pwdError}</p>}
          {pwdSuccess && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">✓ Mot de passe modifié avec succès.</p>}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Mise à jour…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
