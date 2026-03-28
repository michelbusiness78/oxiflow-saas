'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ContratForm, type Contrat } from './ContratForm';
import { fmtEur, fmtDate } from '@/lib/format';
import { deleteContratAction, toggleContratActifAction } from '@/app/actions/contrats';

interface Client { id: string; nom: string; }

interface ContratWithClient extends Contrat {
  client_nom?: string;
}

const TYPE_LABELS = { maintenance: 'Maintenance', support: 'Support', location: 'Location' };
const TYPE_VARIANTS = { maintenance: 'info', support: 'primary', location: 'warning' } as const;

function getContratStatut(c: ContratWithClient): { label: string; variant: 'success' | 'danger' | 'muted' } {
  if (!c.actif)    return { label: 'Inactif',  variant: 'muted'    };
  if (c.date_fin && new Date(c.date_fin) < new Date()) {
    return { label: 'Expiré', variant: 'danger' };
  }
  return { label: 'Actif', variant: 'success' };
}

interface ContratListProps {
  contrats: ContratWithClient[];
  clients:  Client[];
}

export function ContratList({ contrats, clients }: ContratListProps) {
  const [formOpen,  setFormOpen]  = useState(false);
  const [editing,   setEditing]   = useState<Contrat | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');

  async function handleToggle(id: string, current: boolean) {
    setError('');
    const res = await toggleContratActifAction(id, !current);
    if ('error' in res && res.error) setError(res.error);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteContratAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  const columns: Column<ContratWithClient>[] = [
    {
      key: 'client', header: 'Client', sortable: true, sortValue: (r) => r.client_nom ?? '',
      cell: (r) => (
        <div>
          <p className="font-medium text-oxi-text">{r.client_nom ?? '—'}</p>
          <Badge variant={TYPE_VARIANTS[r.type] ?? 'default'} className="mt-0.5">{TYPE_LABELS[r.type]}</Badge>
        </div>
      ),
    },
    {
      key: 'statut', header: 'Statut',
      cell: (r) => {
        const s = getContratStatut(r);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'montant_mensuel', header: 'Mensualité', sortable: true, sortValue: (r) => r.montant_mensuel ?? 0,
      cell: (r) => r.montant_mensuel ? (
        <div>
          <p className="font-semibold text-oxi-text">{fmtEur(r.montant_mensuel)}<span className="text-xs text-oxi-text-muted"> /mois</span></p>
          <p className="text-xs text-oxi-text-muted">{fmtEur(r.montant_mensuel * 12)} /an</p>
        </div>
      ) : <span className="text-oxi-text-muted text-sm">—</span>,
    },
    {
      key: 'date_debut', header: 'Période', sortable: true, sortValue: (r) => r.date_debut,
      cell: (r) => (
        <div className="text-xs text-oxi-text-secondary space-y-0.5">
          <p>Début : {fmtDate(r.date_debut)}</p>
          {r.date_fin && <p>Fin : {fmtDate(r.date_fin)}</p>}
        </div>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actif', header: 'Actif',
      cell: (r) => (
        <button
          onClick={() => handleToggle(r.id, r.actif)}
          className={[
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            r.actif ? 'bg-oxi-primary' : 'bg-oxi-border',
          ].join(' ')}
          role="switch"
          aria-checked={r.actif}
          title={r.actif ? 'Désactiver' : 'Activer'}
        >
          <span className={[
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
            r.actif ? 'translate-x-4.5' : 'translate-x-0.5',
          ].join(' ')} />
        </button>
      ),
      className: 'hidden sm:table-cell',
    },
  ];

  // Compteurs
  const actifs  = contrats.filter((c) => c.actif && (!c.date_fin || new Date(c.date_fin) > new Date())).length;
  const expires = contrats.filter((c) => c.date_fin && new Date(c.date_fin) < new Date()).length;
  const mrrTotal = contrats
    .filter((c) => c.actif && c.montant_mensuel)
    .reduce((s, c) => s + (c.montant_mensuel ?? 0), 0);

  return (
    <>
      {/* Métriques */}
      {contrats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Contrats actifs',    value: String(actifs),     color: 'text-oxi-success' },
            { label: 'Expirés',            value: String(expires),    color: 'text-oxi-danger'  },
            { label: 'MRR total',          value: fmtEur(mrrTotal),   color: 'text-oxi-primary' },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-oxi-border bg-oxi-surface p-3 text-center">
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-oxi-text-muted">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-oxi-text-secondary">{contrats.length} contrat{contrats.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau contrat
        </button>
      </div>

      {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

      <DataTable
        data={contrats}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['client_nom'] as (keyof ContratWithClient)[]}
        searchPlaceholder="Rechercher un client…"
        emptyMessage="Aucun contrat"
        emptyAction={
          <button onClick={() => setFormOpen(true)} className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors">
            Créer un contrat
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
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

      <ContratForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        editing={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Résilier ce contrat ?"
        description="Cette action est irréversible."
        confirmLabel="Résilier"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
