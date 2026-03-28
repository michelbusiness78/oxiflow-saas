'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DossierForm, type Dossier } from './DossierForm';
import { fmtEur, fmtDate } from '@/lib/format';
import { deleteProjetAction, updateProjetAvancementAction } from '@/app/actions/projets';

interface Client { id: string; nom: string; }
interface Devis  { id: string; num: string; client_id: string; }
interface User   { id: string; nom: string; prenom: string; }

interface DossierWithClient extends Dossier {
  client_nom?:  string;
  chef_nom?:    string;
  devis_num?:   string;
}

interface DossierListProps {
  dossiers:  DossierWithClient[];
  clients:   Client[];
  devisList: Devis[];
  users:     User[];
}

// ─── Statut helpers ────────────────────────────────────────────────────────────

type StatutVariant = 'muted' | 'info' | 'success' | 'danger';

function statutConfig(s: string): { label: string; variant: StatutVariant } {
  const map: Record<string, { label: string; variant: StatutVariant }> = {
    en_attente: { label: 'En attente', variant: 'muted'    },
    en_cours:   { label: 'En cours',   variant: 'info'     },
    termine:    { label: 'Terminé',    variant: 'success'  },
    annule:     { label: 'Annulé',     variant: 'danger'   },
  };
  return map[s] ?? { label: s, variant: 'muted' };
}

const STATUT_FILTERS = ['tous', 'en_attente', 'en_cours', 'termine', 'annule'] as const;

export function DossierList({ dossiers, clients, devisList, users }: DossierListProps) {
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Dossier | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [statFilter, setStatFilter] = useState<string>('tous');
  const [error,      setError]      = useState('');

  const filtered = statFilter === 'tous'
    ? dossiers
    : dossiers.filter((d) => d.statut === statFilter);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteProjetAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  async function handlePct(id: string, current: number, delta: number) {
    const res = await updateProjetAvancementAction(id, current + delta);
    if ('error' in res && res.error) setError(res.error);
  }

  // ─── Métriques ───────────────────────────────────────────────────────────────

  const enCours  = dossiers.filter((d) => d.statut === 'en_cours').length;
  const termines = dossiers.filter((d) => d.statut === 'termine').length;
  const mrr      = dossiers
    .filter((d) => d.statut === 'en_cours' && d.montant_ht)
    .reduce((s, d) => s + (d.montant_ht ?? 0), 0);

  // ─── Colonnes ────────────────────────────────────────────────────────────────

  const columns: Column<DossierWithClient>[] = [
    {
      key: 'nom', header: 'Projet', sortable: true, sortValue: (r) => r.nom,
      cell: (r) => (
        <div>
          <p className="font-medium text-oxi-text">{r.nom}</p>
          <p className="text-xs text-oxi-text-muted mt-0.5">{r.client_nom ?? '—'}{r.type_projet ? ` · ${r.type_projet}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'statut', header: 'Statut',
      cell: (r) => {
        const s = statutConfig(r.statut);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'pct_avancement', header: 'Avancement', sortable: true, sortValue: (r) => r.pct_avancement,
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 rounded-full bg-oxi-border overflow-hidden">
            <div
              className="h-full rounded-full bg-oxi-primary transition-all"
              style={{ width: `${r.pct_avancement}%` }}
            />
          </div>
          <span className="text-xs font-medium text-oxi-text-secondary w-8 shrink-0">{r.pct_avancement}%</span>
        </div>
      ),
      className: 'hidden sm:table-cell',
    },
    {
      key: 'montant_ht', header: 'Montant HT', sortable: true, sortValue: (r) => r.montant_ht ?? 0,
      cell: (r) => r.montant_ht
        ? <span className="font-medium text-oxi-text">{fmtEur(r.montant_ht)}</span>
        : <span className="text-oxi-text-muted text-sm">—</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'date_fin_prevue', header: 'Échéance', sortable: true, sortValue: (r) => r.date_fin_prevue ?? '',
      cell: (r) => {
        if (!r.date_fin_prevue) return <span className="text-oxi-text-muted text-xs">—</span>;
        const late = r.statut !== 'termine' && new Date(r.date_fin_prevue) < new Date();
        return (
          <span className={`text-xs ${late ? 'font-medium text-oxi-danger' : 'text-oxi-text-muted'}`}>
            {fmtDate(r.date_fin_prevue)}
          </span>
        );
      },
      className: 'hidden md:table-cell',
    },
    {
      key: 'chef_nom', header: 'Chef projet',
      cell: (r) => <span className="text-xs text-oxi-text-secondary">{r.chef_nom ?? '—'}</span>,
      className: 'hidden lg:table-cell',
    },
  ];

  return (
    <>
      {/* Métriques */}
      {dossiers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'En cours',          value: String(enCours),   color: 'text-oxi-primary' },
            { label: 'Terminés',          value: String(termines),  color: 'text-oxi-success' },
            { label: 'Budget en cours',   value: fmtEur(mrr),       color: 'text-oxi-text'    },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-oxi-border bg-oxi-surface p-3 text-center">
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-oxi-text-muted">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUT_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatFilter(s)}
              className={['rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statFilter === s ? 'bg-oxi-primary text-white' : 'bg-oxi-bg text-oxi-text-secondary hover:bg-oxi-border'].join(' ')}
            >
              {s === 'tous' ? 'Tous' : statutConfig(s).label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau dossier
        </button>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['nom', 'client_nom'] as (keyof DossierWithClient)[]}
        searchPlaceholder="Rechercher un projet ou client…"
        emptyMessage="Aucun dossier"
        emptyAction={
          <button onClick={() => setFormOpen(true)} className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors">
            Créer un dossier
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* Incrémenter avancement */}
            {row.pct_avancement < 100 && (
              <button
                onClick={() => handlePct(row.id, row.pct_avancement, 10)}
                className="rounded-md px-2 py-1 text-xs font-medium text-oxi-primary hover:bg-oxi-primary-light transition-colors"
                title="+10%"
              >
                +10%
              </button>
            )}
            {/* Modifier */}
            <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors" title="Modifier">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
            {/* Supprimer */}
            <button onClick={() => { setError(''); setDeleteId(row.id); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors" title="Supprimer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      />

      <DossierForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        devisList={devisList}
        users={users}
        editing={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce dossier ?"
        description="Les tâches associées seront également supprimées."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
