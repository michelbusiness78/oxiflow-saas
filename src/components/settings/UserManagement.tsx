'use client';

import { useState, useTransition } from 'react';
import {
  inviteUserAction,
  updateUserRoleAction,
  toggleUserStatusAction,
  deleteUserAction,
  type InviteUserInput,
} from '@/app/actions/settings';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'commercial',  label: 'Commercial'     },
  { value: 'technicien',  label: 'Technicien'     },
  { value: 'chef_projet', label: 'Chef de projet' },
  { value: 'rh',          label: 'RH'             },
] as const;

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

const PLAN_LIMITS: Record<string, number> = {
  trial: 3,
  solo:  1,
  team:  5,
  pro:   15,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id:         string;
  name:       string;
  email:      string;
  role:       string;
  status:     string;
  created_at: string;
}

interface Props {
  users:     User[];
  currentId: string;
  plan:      string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-oxi-surface shadow-xl border border-oxi-border p-6">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserManagement({ users: initial, currentId, plan }: Props) {
  const [users, setUsers]             = useState(initial);
  const [showInvite, setShowInvite]   = useState(false);
  const [deleteId,   setDeleteId]     = useState<string | null>(null);
  const [inviteErr,  setInviteErr]    = useState('');
  const [pending, startTransition]    = useTransition();

  const limit     = PLAN_LIMITS[plan] ?? 3;
  const canInvite = users.length < limit;

  // ── Invite ──────────────────────────────────────────────────────────────────

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteErr('');
    const fd   = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const input: InviteUserInput = {
      email: (fd.get('email') as string).trim(),
      name:  (fd.get('name')  as string).trim(),
      role:  fd.get('role') as InviteUserInput['role'],
    };
    startTransition(async () => {
      const res = await inviteUserAction(input);
      if ('error' in res) { setInviteErr(res.error ?? 'Erreur invitation'); return; }
      setShowInvite(false);
      form.reset();
      // L'utilisateur sera visible au prochain rafraîchissement (revalidatePath)
    });
  }

  // ── Role change ─────────────────────────────────────────────────────────────

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, role);
      if ('error' in res) return;
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    });
  }

  // ── Toggle status ────────────────────────────────────────────────────────────

  function handleToggle(userId: string, current: string) {
    const next = current === 'active' ? 'inactive' : 'active';
    startTransition(async () => {
      const res = await toggleUserStatusAction(userId, next);
      if ('error' in res) return;
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: next } : u));
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  function handleDelete(userId: string) {
    startTransition(async () => {
      await deleteUserAction(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteId(null);
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-oxi-text-muted">
          <span className="font-semibold text-oxi-text">{users.length}</span> / {limit}{' '}
          utilisateur{limit > 1 ? 's' : ''} —{' '}
          Plan <span className="capitalize font-medium">{plan}</span>
        </p>
        <button
          onClick={() => setShowInvite(true)}
          disabled={!canInvite || pending}
          className="flex items-center gap-2 self-start rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover disabled:opacity-40 transition-colors"
        >
          <span aria-hidden>+</span> Inviter un utilisateur
        </button>
      </div>

      {!canInvite && (
        <p className="rounded-lg border border-oxi-warning bg-oxi-warning-light px-4 py-2 text-xs text-oxi-warning">
          Limite du plan atteinte. Passez à un plan supérieur pour ajouter des utilisateurs.
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-oxi-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-oxi-border bg-oxi-bg text-left">
              <th className="px-4 py-3 font-medium text-oxi-text-muted">Utilisateur</th>
              <th className="hidden sm:table-cell px-4 py-3 font-medium text-oxi-text-muted">Rôle</th>
              <th className="hidden md:table-cell px-4 py-3 font-medium text-oxi-text-muted">Statut</th>
              <th className="hidden lg:table-cell px-4 py-3 font-medium text-oxi-text-muted">Depuis</th>
              <th className="px-4 py-3 text-right font-medium text-oxi-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-oxi-border">
            {users.map((u) => {
              const isSelf       = u.id === currentId;
              const isProtected  = isSelf || u.role === 'dirigeant';
              return (
                <tr key={u.id} className={['transition-colors hover:bg-oxi-bg/40', u.status === 'inactive' ? 'opacity-50' : ''].join(' ')}>

                  {/* Nom / email */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oxi-primary/10 text-xs font-semibold text-oxi-primary">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-oxi-text">
                          {u.name}
                          {isSelf && <span className="ml-1.5 text-xs text-oxi-text-muted">(vous)</span>}
                        </p>
                        <p className="truncate text-xs text-oxi-text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Rôle */}
                  <td className="hidden sm:table-cell px-4 py-3">
                    {isProtected ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <select
                        value={u.role}
                        disabled={pending}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="rounded-md border border-oxi-border bg-oxi-bg px-2 py-1 text-xs text-oxi-text focus:outline-none focus:ring-1 focus:ring-oxi-primary disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Statut */}
                  <td className="hidden md:table-cell px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-oxi-text-secondary">
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-oxi-success' : 'bg-oxi-text-muted'}`} />
                      {u.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-oxi-text-muted">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {!isProtected && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={pending}
                          onClick={() => handleToggle(u.id, u.status)}
                          className="rounded-md border border-oxi-border px-2.5 py-1 text-xs text-oxi-text-secondary hover:bg-oxi-bg transition-colors disabled:opacity-40"
                        >
                          {u.status === 'active' ? 'Désactiver' : 'Réactiver'}
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => setDeleteId(u.id)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal invitation ── */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <h3 className="mb-4 text-base font-semibold text-oxi-text">Inviter un utilisateur</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-oxi-text mb-1.5">Nom complet *</label>
              <input name="name" required
                className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-oxi-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-oxi-text mb-1.5">Email *</label>
              <input name="email" type="email" required
                className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-oxi-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-oxi-text mb-1.5">Rôle *</label>
              <select name="role" defaultValue="commercial"
                className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-oxi-primary">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-oxi-text-muted">
              L'utilisateur recevra un email pour définir son mot de passe.
            </p>
            {inviteErr && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{inviteErr}</p>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowInvite(false)}
                className="rounded-lg border border-oxi-border px-4 py-2 text-sm text-oxi-text-secondary hover:bg-oxi-bg transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={pending}
                className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover disabled:opacity-50 transition-colors">
                {pending ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal confirmation suppression ── */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)}>
          <h3 className="mb-2 text-base font-semibold text-oxi-text">Supprimer l'utilisateur ?</h3>
          <p className="mb-6 text-sm text-oxi-text-muted">
            Cette action est irréversible. L'utilisateur perdra immédiatement tout accès à OxiFlow.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)}
              className="rounded-lg border border-oxi-border px-4 py-2 text-sm text-oxi-text-secondary hover:bg-oxi-bg transition-colors">
              Annuler
            </button>
            <button disabled={pending} onClick={() => handleDelete(deleteId)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {pending ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
