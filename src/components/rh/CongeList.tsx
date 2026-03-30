'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CongeForm } from './CongeForm';
import { changeCongeStatutAction, deleteCongeAction } from '@/app/actions/rh';
import { fmtDate } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Conge {
  id:          string;
  user_id:     string;
  user_nom:    string;
  type:        'cp' | 'rtt' | 'maladie' | 'sans_solde';
  date_debut:  string;
  date_fin:    string;
  nb_jours:    number;
  commentaire: string | null;
  statut:      'en_attente' | 'valide' | 'refuse';
  created_at:  string;
}

interface Props {
  conges:    Conge[];
  isManager: boolean;
  userId:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Conge['type'], string> = {
  cp:         'CP',
  rtt:        'RTT',
  maladie:    'Maladie',
  sans_solde: 'Sans solde',
};

function statutVariant(s: Conge['statut']): 'warning' | 'success' | 'danger' {
  if (s === 'en_attente') return 'warning';
  if (s === 'valide')     return 'success';
  return 'danger';
}
function statutLabel(s: Conge['statut']) {
  if (s === 'en_attente') return 'En attente';
  if (s === 'valide')     return 'Validé';
  return 'Refusé';
}

function isThisWeek(debut: string, fin: string): boolean {
  const today     = new Date();
  const day       = today.getDay();
  const monday    = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday    = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin   + 'T00:00:00');
  return d <= sunday && f >= monday;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CongeList({ conges, isManager, userId }: Props) {
  const [formOpen,  setFormOpen]  = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');
  const [, startTransition] = useTransition();

  const absentsCetteSemaine = conges.filter(
    (c) => c.statut === 'valide' && isThisWeek(c.date_debut, c.date_fin),
  );

  const stats = {
    enAttente: conges.filter((c) => c.statut === 'en_attente').length,
    valide:    conges.filter((c) => c.statut === 'valide').length,
    refuse:    conges.filter((c) => c.statut === 'refuse').length,
  };

  async function handleStatut(id: string, statut: 'valide' | 'refuse') {
    setError('');
    startTransition(async () => {
      const res = await changeCongeStatutAction(id, statut);
      if (res && 'error' in res && res.error) setError(res.error);
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteCongeAction(deleteId);
    setDeleting(false);
    if (res && 'error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En attente', value: stats.enAttente, color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]' },
          { label: 'Validés',    value: stats.valide,    color: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]' },
          { label: 'Refusés',    value: stats.refuse,    color: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-center">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${s.bg} mb-2`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Absents cette semaine */}
      {absentsCetteSemaine.length > 0 && (
        <div className="rounded-xl border border-[#7C3AED]/20 bg-[#EDE9FE] p-4">
          <p className="text-sm font-semibold text-[#7C3AED] mb-2">
            Absents cette semaine ({absentsCetteSemaine.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {absentsCetteSemaine.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6D28D9] shadow-sm">
                {c.user_nom}
                <span className="text-[#9333EA]">· {TYPE_LABELS[c.type]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {conges.length} demande{conges.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle demande
        </button>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      {/* Liste */}
      {conges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Aucune demande de congé
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-left text-xs text-slate-400">
                {isManager && <th className="px-4 py-3 font-medium">Employé</th>}
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Jours</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Commentaire</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {conges.map((c) => (
                <tr key={c.id} className="hover:bg-white transition-colors">
                  {isManager && (
                    <td className="px-4 py-3 font-semibold text-slate-700">{c.user_nom}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                    {c.nb_jours}j
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statutVariant(c.statut)}>{statutLabel(c.statut)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell max-w-[160px] truncate">
                    {c.commentaire ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Validation manager */}
                      {isManager && c.statut === 'en_attente' && (
                        <>
                          <button
                            onClick={() => handleStatut(c.id, 'valide')}
                            className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-oxi-success hover:opacity-80 transition-opacity"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => handleStatut(c.id, 'refuse')}
                            className="rounded-md bg-oxi-danger-light px-2 py-1 text-xs font-medium text-oxi-danger hover:opacity-80 transition-opacity"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {/* Suppression propre (en attente) */}
                      {c.user_id === userId && c.statut === 'en_attente' && (
                        <button
                          onClick={() => { setError(''); setDeleteId(c.id); }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors"
                          title="Annuler la demande"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CongeForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleteId}
        title="Annuler cette demande ?"
        description="La demande de congé sera supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
