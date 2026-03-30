'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TacheForm, type Tache } from './TacheForm';
import { fmtDate } from '@/lib/format';
import { deleteTacheAction, changeTacheEtatAction } from '@/app/actions/taches';

interface Dossier { id: string; nom: string; }
interface User    { id: string; nom: string; prenom: string; }

interface TacheWithMeta extends Tache {
  projet_nom?:  string;
  assigne_nom?: string;
}

interface TacheListProps {
  taches:   TacheWithMeta[];
  dossiers: Dossier[];
  users:    User[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Variant = 'muted' | 'info' | 'warning' | 'success' | 'danger' | 'primary';

function prioriteConfig(p: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    faible:  { label: 'Faible',   variant: 'muted'    },
    normale: { label: 'Normale',  variant: 'info'     },
    haute:   { label: 'Haute',    variant: 'warning'  },
    urgente: { label: 'Urgente',  variant: 'danger'   },
  };
  return map[p] ?? { label: p, variant: 'muted' };
}

function etatConfig(e: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    a_faire:   { label: 'À faire',   variant: 'muted'    },
    en_cours:  { label: 'En cours',  variant: 'info'     },
    en_review: { label: 'En review', variant: 'warning'  },
    terminee:  { label: 'Terminée',  variant: 'success'  },
  };
  return map[e] ?? { label: e, variant: 'muted' };
}

type EtatFilter = 'tous' | Tache['etat'];
const ETAT_FILTERS: EtatFilter[] = ['tous', 'a_faire', 'en_cours', 'en_review', 'terminee'];

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanCol({
  title,
  variant,
  taches,
  onEdit,
  onMove,
}: {
  title: string;
  variant: Variant;
  taches: TacheWithMeta[];
  onEdit: (t: TacheWithMeta) => void;
  onMove: (id: string, etat: Tache['etat']) => void;
}) {
  return (
    <div className="flex flex-col gap-2 min-h-[200px]">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Badge variant={variant}>{title}</Badge>
        <span className="text-xs text-slate-400">{taches.length}</span>
      </div>
      {taches.map((t) => (
        <div key={t.id} className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 space-y-1.5">
          <p className="text-sm font-semibold text-slate-700 leading-snug">{t.titre}</p>
          {t.projet_nom && <p className="text-xs text-slate-400">{t.projet_nom}</p>}
          <div className="flex items-center justify-between pt-1">
            <Badge variant={prioriteConfig(t.priorite).variant} className="text-xs">{prioriteConfig(t.priorite).label}</Badge>
            <div className="flex gap-1">
              <button onClick={() => onEdit(t)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors" title="Modifier">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
              {t.etat !== 'terminee' && (
                <button
                  onClick={() => {
                    const next: Tache['etat'][] = ['a_faire', 'en_cours', 'en_review', 'terminee'];
                    const idx = next.indexOf(t.etat as Tache['etat']);
                    if (idx < next.length - 1) onMove(t.id, next[idx + 1]);
                  }}
                  className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Avancer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TacheList({ taches, dossiers, users }: TacheListProps) {
  const [formOpen,    setFormOpen]    = useState(false);
  const [editing,     setEditing]     = useState<Tache | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [etatFilter,  setEtatFilter]  = useState<EtatFilter>('tous');
  const [kanban,      setKanban]      = useState(false);
  const [error,       setError]       = useState('');

  const filtered = etatFilter === 'tous' ? taches : taches.filter((t) => t.etat === etatFilter);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteTacheAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  async function handleMove(id: string, etat: Tache['etat']) {
    const res = await changeTacheEtatAction(id, etat);
    if ('error' in res && res.error) setError(res.error);
  }

  // ─── Table columns ───────────────────────────────────────────────────────────

  const columns: Column<TacheWithMeta>[] = [
    {
      key: 'titre', header: 'Tâche', sortable: true, sortValue: (r) => r.titre,
      cell: (r) => (
        <div>
          <p className="font-semibold text-slate-700">{r.titre}</p>
          {r.projet_nom && <p className="text-xs text-slate-400 mt-0.5">{r.projet_nom}</p>}
        </div>
      ),
    },
    {
      key: 'priorite', header: 'Priorité',
      cell: (r) => {
        const p = prioriteConfig(r.priorite);
        return <Badge variant={p.variant}>{p.label}</Badge>;
      },
    },
    {
      key: 'etat', header: 'État',
      cell: (r) => {
        const e = etatConfig(r.etat);
        return <Badge variant={e.variant}>{e.label}</Badge>;
      },
    },
    {
      key: 'assigne_nom', header: 'Assigné',
      cell: (r) => <span className="text-sm text-slate-500">{r.assigne_nom ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'pct_avancement', header: '%', sortable: true, sortValue: (r) => r.pct_avancement,
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${r.pct_avancement}%` }} />
          </div>
          <span className="text-xs text-slate-400">{r.pct_avancement}%</span>
        </div>
      ),
      className: 'hidden sm:table-cell',
    },
    {
      key: 'date_echeance', header: 'Échéance', sortable: true, sortValue: (r) => r.date_echeance ?? '',
      cell: (r) => {
        if (!r.date_echeance) return <span className="text-xs text-slate-400">—</span>;
        const late = r.etat !== 'terminee' && new Date(r.date_echeance) < new Date();
        return <span className={`text-xs ${late ? 'font-medium text-oxi-danger' : 'text-slate-400'}`}>{fmtDate(r.date_echeance)}</span>;
      },
      className: 'hidden md:table-cell',
    },
  ];

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const aFaire   = taches.filter((t) => t.etat === 'a_faire').length;
  const enCours  = taches.filter((t) => t.etat === 'en_cours' || t.etat === 'en_review').length;
  const termines = taches.filter((t) => t.etat === 'terminee').length;

  return (
    <>
      {/* Métriques */}
      {taches.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'À faire',   value: String(aFaire),   color: 'text-slate-500' },
            { label: 'En cours',  value: String(enCours),  color: 'text-blue-600'        },
            { label: 'Terminées', value: String(termines), color: 'text-oxi-success'        },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-center">
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-400">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ETAT_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setEtatFilter(s)}
              className={['rounded-full px-3 py-1 text-xs font-medium transition-colors',
                etatFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'].join(' ')}
            >
              {s === 'tous' ? 'Toutes' : etatConfig(s).label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Vue Kanban / Liste toggle */}
          <button
            onClick={() => setKanban((v) => !v)}
            className={['rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              kanban ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-white'].join(' ')}
          >
            {kanban ? 'Vue liste' : 'Vue Kanban'}
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle tâche
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      {/* Kanban */}
      {kanban ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['a_faire', 'en_cours', 'en_review', 'terminee'] as Tache['etat'][]).map((etat) => (
            <KanbanCol
              key={etat}
              title={etatConfig(etat).label}
              variant={etatConfig(etat).variant}
              taches={taches.filter((t) => t.etat === etat)}
              onEdit={(t) => { setEditing(t); setFormOpen(true); }}
              onMove={handleMove}
            />
          ))}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(r) => r.id}
          searchKeys={['titre', 'projet_nom', 'assigne_nom'] as (keyof TacheWithMeta)[]}
          searchPlaceholder="Rechercher une tâche…"
          emptyMessage="Aucune tâche"
          emptyAction={
            <button onClick={() => setFormOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Créer une tâche
            </button>
          }
          actions={(row) => (
            <div className="flex items-center justify-end gap-1">
              {row.etat !== 'terminee' && (
                <button
                  onClick={() => handleMove(row.id, 'terminee')}
                  className="rounded-md px-2 py-1 text-xs font-medium text-oxi-success bg-green-50 hover:opacity-80 transition-opacity"
                  title="Marquer terminée"
                >
                  ✓
                </button>
              )}
              <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors" title="Modifier">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
              <button onClick={() => { setError(''); setDeleteId(row.id); }} className="rounded-md p-1.5 text-slate-400 hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors" title="Supprimer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          )}
        />
      )}

      <TacheForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        dossiers={dossiers}
        users={users}
        editing={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette tâche ?"
        description="Cette action est irréversible."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
