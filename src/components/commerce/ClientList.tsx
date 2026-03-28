'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ClientForm } from './ClientForm';
import { deleteClientAction } from '@/app/actions/commerce';

export interface Client {
  id:         string;
  nom:        string;
  contact:    string;
  email:      string;
  tel:        string;
  adresse:    string;
  cp:         string;
  ville:      string;
  notes:      string;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

interface ClientListProps {
  clients: Client[];
}

export function ClientList({ clients }: ClientListProps) {
  const [formOpen,  setFormOpen]  = useState(false);
  const [editing,   setEditing]   = useState<Client | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(c: Client) { setEditing(c); setFormOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteClientAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setDeleteErr(res.error); return; }
    setDeleteId(null);
  }

  const columns: Column<Client>[] = [
    {
      key:       'nom',
      header:    'Client',
      sortable:  true,
      sortValue: (r) => r.nom,
      cell:      (r) => (
        <div>
          <p className="font-medium text-oxi-text">{r.nom}</p>
          {r.contact && <p className="text-xs text-oxi-text-muted">{r.contact}</p>}
        </div>
      ),
    },
    {
      key:       'ville',
      header:    'Ville',
      sortable:  true,
      sortValue: (r) => r.ville,
      cell:      (r) => (
        <span className="text-oxi-text-secondary">
          {[r.cp, r.ville].filter(Boolean).join(' ') || '—'}
        </span>
      ),
      className: 'hidden sm:table-cell',
    },
    {
      key:    'email',
      header: 'Contact',
      cell:   (r) => (
        <div className="space-y-0.5">
          {r.email && <p className="text-xs text-oxi-text-secondary">{r.email}</p>}
          {r.tel   && <p className="text-xs text-oxi-text-muted">{r.tel}</p>}
        </div>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key:       'created_at',
      header:    'Depuis',
      sortable:  true,
      sortValue: (r) => r.created_at,
      cell:      (r) => <span className="text-xs text-oxi-text-muted">{fmtDate(r.created_at)}</span>,
      className: 'hidden lg:table-cell',
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-oxi-text-secondary">
          {clients.length} client{clients.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau client
        </button>
      </div>

      {deleteErr && (
        <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
          {deleteErr}
        </div>
      )}

      <DataTable
        data={clients}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['nom', 'ville', 'email', 'contact'] as (keyof Client)[]}
        searchPlaceholder="Rechercher un client…"
        emptyMessage="Aucun client pour l'instant"
        emptyAction={
          <button
            onClick={openCreate}
            className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
          >
            Ajouter votre premier client
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => openEdit(row)}
              className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors"
              title="Modifier"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button
              onClick={() => { setDeleteErr(''); setDeleteId(row.id); }}
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

      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer ce client ?"
        description="Cette action est irréversible. Les devis et factures associés seront conservés mais sans lien vers ce client."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
