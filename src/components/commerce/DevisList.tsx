'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, devisVariant, devisLabel } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DevisForm, type Devis } from './DevisForm';
import { fmtEur, fmtDate } from '@/lib/format';
import {
  deleteDevisAction,
  changeDevisStatutAction,
  dupliquerDevisAction,
  type DevisLigne,
} from '@/app/actions/commerce';
import type { CatalogueItem } from '@/app/actions/catalogue';

interface Client { id: string; nom: string; }

interface DevisWithClient extends Devis {
  client_nom?: string;
}

interface DevisListProps {
  devis:     DevisWithClient[];
  clients:   Client[];
  catalogue?: CatalogueItem[];
}

const STATUTS = ['tous', 'brouillon', 'envoye', 'accepte', 'refuse'] as const;

export function DevisList({ devis, clients, catalogue }: DevisListProps) {
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Devis | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [error,      setError]      = useState('');

  const filtered = statusFilter === 'tous'
    ? devis
    : devis.filter((d) => d.statut === statusFilter);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(d: Devis) { setEditing(d); setFormOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteDevisAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  async function handleAccepter(id: string) {
    setError('');
    const res = await changeDevisStatutAction(id, 'accepte');
    if ('error' in res && res.error) setError(res.error);
  }

  async function handleDupliquer(id: string) {
    setError('');
    const res = await dupliquerDevisAction(id);
    if ('error' in res && res.error) setError(res.error);
  }

  const columns: Column<DevisWithClient>[] = [
    {
      key:       'num',
      header:    'N° Devis',
      sortable:  true,
      sortValue: (r) => r.num,
      cell:      (r) => <span className="font-mono text-sm font-medium text-oxi-text">{r.num}</span>,
    },
    {
      key:       'client',
      header:    'Client',
      sortable:  true,
      sortValue: (r) => r.client_nom ?? '',
      cell:      (r) => <span className="text-oxi-text-secondary">{r.client_nom ?? '—'}</span>,
    },
    {
      key:    'statut',
      header: 'Statut',
      cell:   (r) => (
        <Badge variant={devisVariant(r.statut)}>{devisLabel(r.statut)}</Badge>
      ),
    },
    {
      key:       'montant_ttc',
      header:    'Total TTC',
      sortable:  true,
      sortValue: (r) => r.montant_ttc,
      cell:      (r) => (
        <span className="font-semibold text-oxi-text">{fmtEur(r.montant_ttc)}</span>
      ),
    },
    {
      key:       'date',
      header:    'Date',
      sortable:  true,
      sortValue: (r) => r.date,
      cell:      (r) => <span className="text-xs text-oxi-text-muted">{fmtDate(r.date)}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key:       'validite',
      header:    'Validité',
      sortable:  true,
      sortValue: (r) => r.validite,
      cell:      (r) => {
        const expired = r.validite && new Date(r.validite) < new Date() && r.statut === 'envoye';
        return (
          <span className={`text-xs ${expired ? 'text-oxi-danger font-medium' : 'text-oxi-text-muted'}`}>
            {fmtDate(r.validite)}
          </span>
        );
      },
      className: 'hidden lg:table-cell',
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filtres statut */}
        <div className="flex flex-wrap gap-1.5">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-oxi-primary text-white'
                  : 'bg-oxi-bg text-oxi-text-secondary hover:bg-oxi-border',
              ].join(' ')}
            >
              {s === 'tous' ? 'Tous' : devisLabel(s)}
            </button>
          ))}
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau devis
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['num', 'client_nom'] as (keyof DevisWithClient)[]}
        searchPlaceholder="Rechercher par n° ou client…"
        emptyMessage="Aucun devis"
        emptyAction={
          <button
            onClick={openCreate}
            className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
          >
            Créer votre premier devis
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* Accepter */}
            {row.statut === 'envoye' && (
              <button
                onClick={() => handleAccepter(row.id)}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-oxi-success bg-oxi-success-light hover:opacity-80 transition-opacity"
                title="Marquer comme accepté"
              >
                Accepter
              </button>
            )}
            {/* Dupliquer */}
            <button
              onClick={() => handleDupliquer(row.id)}
              className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors"
              title="Dupliquer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
              </svg>
            </button>
            {/* Modifier */}
            {['brouillon', 'envoye'].includes(row.statut) && (
              <button
                onClick={() => openEdit(row)}
                className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors"
                title="Modifier"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}
            {/* Supprimer */}
            <button
              onClick={() => { setError(''); setDeleteId(row.id); }}
              className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors"
              title="Supprimer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      />

      <DevisForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clients={clients}
        catalogue={catalogue}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce devis ?"
        description="Cette action est irréversible."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
