'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TenantUser, UserEditInput } from '@/app/actions/users-management';
import { saveUser, toggleUserActive } from '@/app/actions/users-management';
import { inviteUserAction, deleteUserAction } from '@/app/actions/settings';
import type { Company } from '@/app/actions/companies';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'dirigeant',   label: 'Dirigeant'       },
  { value: 'commercial',  label: 'Commercial'       },
  { value: 'chef_projet', label: 'Chef de projet'   },
  { value: 'technicien',  label: 'Technicien'       },
  { value: 'rh',          label: 'RH'               },
] as const;

const ROLE_COLOR: Record<string, string> = {
  dirigeant:   '#16a34a',
  commercial:  '#ea580c',
  chef_projet: '#2563eb',
  technicien:  '#22c55e',
  rh:          '#7c3aed',
};

const ROLE_LABEL: Record<string, string> = {
  dirigeant:   'Dirigeant',
  commercial:  'Commercial',
  chef_projet: 'Chef projet',
  technicien:  'Technicien',
  rh:          'RH',
};

const PLAN_LIMITS: Record<string, number> = { trial: 3, solo: 1, team: 5, pro: 15 };

const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  users:         TenantUser[];
  companies:     Company[];
  currentUserId: string;
  plan:          string;
}

type PanelMode = 'none' | 'edit' | 'invite';

const EMPTY_EDIT: UserEditInput = {
  first_name:      null,
  last_name:       null,
  role:            'commercial',
  company_id:      null,
  commercial_code: null,
  color:           '#2563eb',
  active:          true,
};

// ─── UserList ─────────────────────────────────────────────────────────────────

export function UserList({ users, companies, currentUserId, plan }: Props) {
  const router  = useRouter();
  const [pending, startTransition] = useTransition();

  // Panel state
  const [panelMode, setPanelMode]   = useState<PanelMode>('none');
  const [editTarget, setEditTarget] = useState<TenantUser | null>(null);
  const [editForm, setEditForm]     = useState<UserEditInput>(EMPTY_EDIT);
  const [editEmail, setEditEmail]   = useState('');
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  // Delete state
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteError,   setDeleteError]   = useState('');

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName,  setInviteName]  = useState('');
  const [inviteRole,  setInviteRole]  = useState<'commercial' | 'technicien' | 'chef_projet' | 'rh'>('commercial');
  const [inviteError, setInviteError] = useState('');
  const [tempPwd,     setTempPwd]     = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const limit         = PLAN_LIMITS[plan] ?? 3;

  // Init edit form when panel opens
  useEffect(() => {
    if (panelMode === 'edit' && editTarget) {
      setEditForm({
        first_name:      editTarget.first_name,
        last_name:       editTarget.last_name,
        role:            editTarget.role ?? 'commercial',
        company_id:      editTarget.company_id,
        commercial_code: editTarget.commercial_code,
        color:           editTarget.color ?? '#2563eb',
        active:          editTarget.active,
      });
      setEditEmail(editTarget.email ?? '');
      setSaveError(null);
    }
    if (panelMode !== 'none') setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [panelMode, editTarget]);

  function closePanel() {
    setPanelMode('none');
    setEditTarget(null);
    setTempPwd(null);
    setCopied(false);
    setInviteEmail('');
    setInviteName('');
    setInviteError('');
  }

  function setField(key: keyof UserEditInput, val: string | boolean | null) {
    setEditForm((f) => ({ ...f, [key]: val }));
  }

  // ── Edit submit ──────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    const res = await saveUser(
      { ...editForm, email: editEmail.trim() || undefined },
      editTarget.id,
    );
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    closePanel();
    router.refresh();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  function handleDelete(userId: string) {
    setDeleteError('');
    startTransition(async () => {
      const res = await deleteUserAction(userId);
      if (res && 'error' in res) { setDeleteError(res.error ?? 'Erreur'); return; }
      setDeleteId(null);
      router.refresh();
    });
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  function handleToggle(userId: string) {
    startTransition(async () => {
      await toggleUserActive(userId);
      router.refresh();
    });
  }

  // ── Invite submit ────────────────────────────────────────────────────────────
  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof inviteUserAction>>;
      try {
        res = await inviteUserAction({
          email: inviteEmail.trim(),
          name:  inviteName.trim(),
          role:  inviteRole,
        });
        console.log('[UI-DEBUG] inviteUserAction response:', res);
      } catch (err: unknown) {
        const e = err as Error;
        console.log('[UI-DEBUG] inviteUserAction THREW:', e?.message, e?.stack);
        throw err;
      }
      if ('error' in res) { setInviteError(res.error ?? 'Erreur'); return; }
      setTempPwd(res.tempPassword ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            👥 Utilisateurs — Comptes de toutes les applications
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {users.length} / {limit} — Plan <span className="capitalize font-medium">{plan}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanelMode('invite')}
          disabled={users.length >= limit}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {/* ── Cards ── */}
      {users.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Aucun utilisateur.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              pending={pending}
              onEdit={() => { setEditTarget(u); setPanelMode('edit'); }}
              onToggle={() => handleToggle(u.id)}
              onDelete={() => { setDeleteId(u.id); setDeleteError(''); }}
            />
          ))}
        </div>
      )}

      {/* ── Slide panel ── */}
      {panelMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30" onClick={closePanel} />
          <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl overflow-y-auto">

            {/* Panel header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h3 className="text-base font-semibold text-slate-800">
                {panelMode === 'edit' ? 'Modifier le profil' : 'Inviter un utilisateur'}
              </h3>
              <button onClick={closePanel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            {/* ── Edit form ── */}
            {panelMode === 'edit' && (
              <form onSubmit={handleSave} className="flex-1 space-y-6 p-6">

                <Section title="Identité">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom">
                      <input ref={firstInputRef}
                        value={editForm.first_name ?? ''}
                        onChange={(e) => setField('first_name', e.target.value || null)}
                        className={INPUT} placeholder="Prénom" />
                    </Field>
                    <Field label="Nom">
                      <input value={editForm.last_name ?? ''}
                        onChange={(e) => setField('last_name', e.target.value || null)}
                        className={INPUT} placeholder="Nom" />
                    </Field>
                  </div>
                  <Field label="Email">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className={INPUT}
                      placeholder="email@exemple.fr"
                    />
                  </Field>
                </Section>

                <Section title="Rôle &amp; affectation">
                  <Field label="Rôle">
                    <select value={editForm.role}
                      onChange={(e) => setField('role', e.target.value)}
                      className={INPUT}>
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Société rattachée">
                    <select value={editForm.company_id ?? ''}
                      onChange={(e) => setField('company_id', e.target.value || null)}
                      className={INPUT}>
                      <option value="">— Toutes (non rattaché) —</option>
                      {companies.filter((c) => c.active).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                  {editForm.role === 'commercial' && (
                    <Field label="Code commercial">
                      <input value={editForm.commercial_code ?? ''}
                        onChange={(e) => setField('commercial_code', e.target.value.toUpperCase() || null)}
                        className={INPUT} placeholder="COM1" maxLength={10} />
                    </Field>
                  )}
                </Section>

                <Section title="Apparence">
                  <Field label="Couleur de l'avatar">
                    <div className="flex items-center gap-3">
                      <input type="color" value={editForm.color}
                        onChange={(e) => setField('color', e.target.value)}
                        className="h-9 w-16 cursor-pointer rounded border border-slate-300 p-0.5" />
                      <span className="text-sm text-slate-500">{editForm.color}</span>
                    </div>
                  </Field>
                </Section>

                <Section title="Statut">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={editForm.active}
                      onChange={(e) => setField('active', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    <span className="text-sm text-slate-700">Compte actif</span>
                  </label>
                </Section>

                {saveError && <p className="text-sm text-red-600">{saveError}</p>}

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <button type="button" onClick={closePanel}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Invite form ── */}
            {panelMode === 'invite' && (
              <div className="flex-1 p-6">
                {tempPwd ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">✓</span>
                      <h4 className="text-base font-semibold text-slate-800">Compte créé !</h4>
                    </div>
                    <p className="text-sm text-slate-500">
                      Communiquez ces identifiants. L&apos;utilisateur devra changer son mot de passe à la première connexion.
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <p className="text-xs font-medium text-slate-500">Mot de passe temporaire</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-semibold text-slate-800">
                          {tempPwd}
                        </code>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(tempPwd); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                          className="rounded border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-white">
                          {copied ? '✓' : 'Copier'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">Ce mot de passe ne sera plus affiché après fermeture.</p>
                    <div className="flex justify-end">
                      <button onClick={closePanel}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                        Fermer
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-5">
                    <Section title="Nouveau compte">
                      <Field label="Nom complet *">
                        <input ref={firstInputRef} value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          required className={INPUT} placeholder="Prénom Nom" />
                      </Field>
                      <Field label="Email *">
                        <input type="email" value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required className={INPUT} placeholder="prenom.nom@societe.fr" />
                      </Field>
                      <Field label="Rôle *">
                        <select value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                          className={INPUT}>
                          <option value="commercial">Commercial</option>
                          <option value="chef_projet">Chef de projet</option>
                          <option value="technicien">Technicien</option>
                          <option value="rh">RH</option>
                        </select>
                      </Field>
                    </Section>
                    <p className="text-xs text-slate-400">
                      Un mot de passe temporaire sera généré. Aucun email n&apos;est envoyé automatiquement.
                    </p>
                    {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                      <button type="button" onClick={closePanel}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Annuler
                      </button>
                      <button type="submit" disabled={pending}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {pending ? 'Création…' : 'Créer le compte'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal confirmation suppression ── */}
      {deleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDeleteId(null)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-800">Supprimer cet utilisateur ?</h3>
              <p className="text-sm text-slate-500">
                Cette action est irréversible. L&apos;utilisateur perdra immédiatement tout accès à OxiFlow.
              </p>
              {deleteError && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{deleteError}</p>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(deleteId)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {pending ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── UserCard ─────────────────────────────────────────────────────────────────

function UserCard({
  user, isSelf, pending, onEdit, onToggle, onDelete,
}: {
  user:      TenantUser;
  isSelf:    boolean;
  pending:   boolean;
  onEdit:    () => void;
  onToggle:  () => void;
  onDelete:  () => void;
}) {
  const roleColor = ROLE_COLOR[user.role] ?? '#94a3b8';
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const initials  = initials2(user.first_name, user.last_name, user.name);
  const fullName  = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || '—';

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3 p-4"
      style={{ borderLeft: `4px solid ${roleColor}` }}
    >
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: user.color ?? '#2563eb' }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 uppercase leading-snug truncate">{fullName}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        {/* Active badge */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {user.active ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Role + company */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: roleColor }}
        >
          {roleLabel}
        </span>
        {user.company_name && (
          <span className="text-xs text-slate-500">{user.company_name}</span>
        )}
        {user.commercial_code && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
            {user.commercial_code}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-slate-100">
        <button onClick={onEdit}
          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          🖊 Modifier
        </button>
        {!isSelf && (
          <button onClick={onToggle} disabled={pending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            {user.active ? 'Désactiver' : 'Réactiver'}
          </button>
        )}
        {!isSelf && (
          <button onClick={onDelete} disabled={pending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials2(first: string | null, last: string | null, fallback: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first)          return first.slice(0, 2).toUpperCase();
  if (last)           return last.slice(0, 2).toUpperCase();
  return fallback ? fallback.slice(0, 2).toUpperCase() : '?';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
