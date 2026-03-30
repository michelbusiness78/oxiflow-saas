'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NoteFraisForm } from './NoteFraisForm';
import { changeNoteFraisStatutAction, deleteNoteFraisAction } from '@/app/actions/rh';
import { fmtDate, fmtEur } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteFrais {
  id:               string;
  user_id:          string;
  user_nom:         string;
  date:             string;
  montant:          number;
  categorie:        'transport' | 'repas' | 'hebergement' | 'fournitures' | 'autre';
  description:      string | null;
  justificatif_url: string | null;
  statut:           'soumise' | 'validee' | 'remboursee' | 'rejetee';
  created_at:       string;
}

interface Props {
  notes:     NoteFrais[];
  isManager: boolean;
  userId:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_LABELS: Record<NoteFrais['categorie'], string> = {
  transport:    'Transport',
  repas:        'Repas',
  hebergement:  'Hébergement',
  fournitures:  'Fournitures',
  autre:        'Autre',
};

const CAT_ICONS: Record<NoteFrais['categorie'], string> = {
  transport:   '🚗',
  repas:       '🍽️',
  hebergement: '🏨',
  fournitures: '📦',
  autre:       '📄',
};

function statutVariant(s: NoteFrais['statut']): 'warning' | 'success' | 'info' | 'danger' {
  if (s === 'soumise')   return 'warning';
  if (s === 'validee')   return 'info';
  if (s === 'remboursee') return 'success';
  return 'danger';
}

function statutLabel(s: NoteFrais['statut']) {
  const map: Record<NoteFrais['statut'], string> = {
    soumise:    'Soumise',
    validee:    'Validée',
    remboursee: 'Remboursée',
    rejetee:    'Rejetée',
  };
  return map[s] ?? s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoteFraisList({ notes, isManager, userId }: Props) {
  const [formOpen,  setFormOpen]  = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');
  const [, startTransition] = useTransition();

  const totalSoumis  = notes.filter((n) => n.statut === 'soumise').reduce((s, n) => s + n.montant, 0);
  const totalValide  = notes.filter((n) => n.statut === 'validee' || n.statut === 'remboursee').reduce((s, n) => s + n.montant, 0);
  const aValider     = notes.filter((n) => n.statut === 'soumise').length;

  async function handleStatut(id: string, statut: 'validee' | 'remboursee' | 'rejetee') {
    setError('');
    startTransition(async () => {
      const res = await changeNoteFraisStatutAction(id, statut);
      if (res && 'error' in res && res.error) setError(res.error);
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteNoteFraisAction(deleteId);
    setDeleting(false);
    if (res && 'error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: isManager ? 'À valider' : 'En attente', value: aValider,  color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]', fmt: String(aValider) },
          { label: 'En attente (€)',  value: totalSoumis, color: 'text-[#7C3AED]', bg: 'bg-[#EDE9FE]', fmt: fmtEur(totalSoumis) },
          { label: 'Validé (€)',      value: totalValide, color: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]', fmt: fmtEur(totalValide) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <div className={`inline-flex items-center justify-center rounded-lg ${s.bg} px-2.5 py-1 mb-2`}>
              <span className={`text-sm font-bold ${s.color}`}>{s.fmt}</span>
            </div>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {notes.length} note{notes.length !== 1 ? 's' : ''} de frais
        </p>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle note
        </button>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      {/* Liste */}
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Aucune note de frais
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-left text-xs text-slate-400">
                {isManager && <th className="px-4 py-3 font-medium">Employé</th>}
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Justif.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {notes.map((n) => (
                <tr key={n.id} className="hover:bg-white transition-colors">
                  {isManager && (
                    <td className="px-4 py-3 font-semibold text-slate-700">{n.user_nom}</td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{fmtDate(n.date)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                      <span aria-hidden>{CAT_ICONS[n.categorie]}</span>
                      {CAT_LABELS[n.categorie]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {fmtEur(n.montant)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell max-w-[160px] truncate">
                    {n.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statutVariant(n.statut)}>{statutLabel(n.statut)}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {n.justificatif_url ? (
                      <a
                        href={n.justificatif_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7C3AED] hover:underline text-xs"
                      >
                        Voir
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Validation manager */}
                      {isManager && n.statut === 'soumise' && (
                        <>
                          <button
                            onClick={() => handleStatut(n.id, 'validee')}
                            className="rounded-md bg-oxi-info-light px-2 py-1 text-xs font-medium text-oxi-info hover:opacity-80 transition-opacity"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => handleStatut(n.id, 'rejetee')}
                            className="rounded-md bg-oxi-danger-light px-2 py-1 text-xs font-medium text-oxi-danger hover:opacity-80 transition-opacity"
                          >
                            Rejeter
                          </button>
                        </>
                      )}
                      {isManager && n.statut === 'validee' && (
                        <button
                          onClick={() => handleStatut(n.id, 'remboursee')}
                          className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-oxi-success hover:opacity-80 transition-opacity"
                        >
                          Remboursée
                        </button>
                      )}
                      {/* Suppression propre */}
                      {n.user_id === userId && n.statut === 'soumise' && (
                        <button
                          onClick={() => { setError(''); setDeleteId(n.id); }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors"
                          title="Supprimer"
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

      <NoteFraisForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette note de frais ?"
        description="La note de frais sera définitivement supprimée."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
