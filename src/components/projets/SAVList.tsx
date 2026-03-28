'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SAVForm, type SAVTicket } from './SAVForm';
import { fmtDate } from '@/lib/format';
import { deleteSAVAction, changeSAVStatutAction } from '@/app/actions/sav';

interface Client  { id: string; nom: string; }
interface Contrat { id: string; client_id: string; type: string; actif: boolean; }
interface User    { id: string; nom: string; prenom: string; }

interface SAVWithMeta extends SAVTicket {
  client_nom?:  string;
  assigne_nom?: string;
  sous_contrat?: boolean;
}

interface SAVListProps {
  tickets:  SAVWithMeta[];
  clients:  Client[];
  contrats: Contrat[];
  users:    User[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Variant = 'muted' | 'info' | 'warning' | 'success' | 'danger';

function prioriteConfig(p: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    faible:  { label: 'Faible',  variant: 'muted'   },
    normale: { label: 'Normale', variant: 'info'    },
    haute:   { label: 'Haute',   variant: 'warning' },
    urgente: { label: 'Urgente', variant: 'danger'  },
  };
  return map[p] ?? { label: p, variant: 'muted' };
}

function statutConfig(s: string): { label: string; variant: Variant } {
  const map: Record<string, { label: string; variant: Variant }> = {
    ouvert:   { label: 'Ouvert',   variant: 'danger'  },
    en_cours: { label: 'En cours', variant: 'warning' },
    resolu:   { label: 'Résolu',   variant: 'success' },
    cloture:  { label: 'Clôturé',  variant: 'muted'   },
  };
  return map[s] ?? { label: s, variant: 'muted' };
}

const STATUT_FILTERS = ['tous', 'ouvert', 'en_cours', 'resolu', 'cloture'] as const;

export function SAVList({ tickets, clients, contrats, users }: SAVListProps) {
  const [formOpen,    setFormOpen]    = useState(false);
  const [editing,     setEditing]     = useState<SAVTicket | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [statFilter,  setStatFilter]  = useState<string>('tous');
  const [error,       setError]       = useState('');

  const filtered = statFilter === 'tous' ? tickets : tickets.filter((t) => t.statut === statFilter);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteSAVAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  async function handleStatut(id: string, statut: SAVTicket['statut']) {
    const res = await changeSAVStatutAction(id, statut);
    if ('error' in res && res.error) setError(res.error);
  }

  // ─── Compteurs ───────────────────────────────────────────────────────────────
  const ouverts  = tickets.filter((t) => t.statut === 'ouvert').length;
  const enCours  = tickets.filter((t) => t.statut === 'en_cours').length;
  const resolus  = tickets.filter((t) => t.statut === 'resolu' || t.statut === 'cloture').length;

  // ─── Colonnes ────────────────────────────────────────────────────────────────
  const columns: Column<SAVWithMeta>[] = [
    {
      key: 'titre', header: 'Ticket', sortable: true, sortValue: (r) => r.titre ?? '',
      cell: (r) => (
        <div>
          <p className="font-medium text-oxi-text">{r.titre ?? '(Sans titre)'}</p>
          <p className="text-xs text-oxi-text-muted mt-0.5">
            {r.client_nom ?? '—'}
            {r.sous_contrat && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-oxi-success-light px-1.5 py-0.5 text-[10px] font-medium text-oxi-success">
                sous contrat
              </span>
            )}
          </p>
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
      key: 'statut', header: 'Statut',
      cell: (r) => {
        const s = statutConfig(r.statut);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'assigne_nom', header: 'Technicien',
      cell: (r) => <span className="text-sm text-oxi-text-secondary">{r.assigne_nom ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'date_ouverture', header: 'Ouvert le', sortable: true, sortValue: (r) => r.date_ouverture,
      cell: (r) => <span className="text-xs text-oxi-text-muted">{fmtDate(r.date_ouverture)}</span>,
      className: 'hidden lg:table-cell',
    },
    {
      key: 'date_resolution', header: 'Résolu le', sortable: true, sortValue: (r) => r.date_resolution ?? '',
      cell: (r) => <span className="text-xs text-oxi-text-muted">{r.date_resolution ? fmtDate(r.date_resolution) : '—'}</span>,
      className: 'hidden lg:table-cell',
    },
  ];

  return (
    <>
      {/* Compteurs */}
      {tickets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ouverts',  value: String(ouverts),  color: 'text-oxi-danger'  },
            { label: 'En cours', value: String(enCours),  color: 'text-oxi-warning' },
            { label: 'Résolus',  value: String(resolus),  color: 'text-oxi-success' },
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
          Nouveau ticket
        </button>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['titre', 'client_nom', 'assigne_nom'] as (keyof SAVWithMeta)[]}
        searchPlaceholder="Rechercher un ticket ou client…"
        emptyMessage="Aucun ticket SAV"
        emptyAction={
          <button onClick={() => setFormOpen(true)} className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors">
            Créer un ticket
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {row.statut === 'ouvert' && (
              <button
                onClick={() => handleStatut(row.id, 'en_cours')}
                className="rounded-md px-2 py-1 text-xs font-medium text-oxi-warning bg-oxi-warning-light hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                Prendre en charge
              </button>
            )}
            {row.statut === 'en_cours' && (
              <button
                onClick={() => handleStatut(row.id, 'resolu')}
                className="rounded-md px-2 py-1 text-xs font-medium text-oxi-success bg-oxi-success-light hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                Résoudre
              </button>
            )}
            <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors" title="Modifier">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
            </button>
            <button onClick={() => { setError(''); setDeleteId(row.id); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors" title="Supprimer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      />

      <SAVForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        contrats={contrats}
        users={users}
        editing={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce ticket ?"
        description="Cette action est irréversible."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
