'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, factureVariant, factureLabel } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExportCSV } from './ExportCSV';
import { FactureForm, type Facture } from './FactureForm';
import { fmtEur, fmtDate } from '@/lib/format';
import {
  deleteFactureAction,
  changeFactureStatutAction,
  creerAvoirAction,
} from '@/app/actions/factures';
import type { DevisLigne } from '@/app/actions/commerce';
import { generatePDF } from '@/lib/pdf';

interface Client { id: string; nom: string; }

interface FactureWithClient extends Facture {
  client_nom?: string;
}

// ─── Calcul relance ────────────────────────────────────────────────────────────

function getRelance(f: FactureWithClient): { label: string; variant: 'warning' | 'danger' } | null {
  if (!f.echeance) return null;
  if (!['envoyee', 'impayee', 'partielle'].includes(f.statut)) return null;
  const days = Math.floor((Date.now() - new Date(f.echeance).getTime()) / 86_400_000);
  if (days >= 30) return { label: 'J+30', variant: 'danger'  };
  if (days >= 15) return { label: 'J+15', variant: 'warning' };
  if (days >= 5)  return { label: 'J+5',  variant: 'warning' };
  return null;
}

const STATUTS = ['tous', 'brouillon', 'envoyee', 'payee', 'partielle', 'impayee'] as const;

interface FactureListProps {
  factures:  FactureWithClient[];
  clients:   Client[];
  fromDevis?: { client_id: string; lignes: DevisLigne[]; montant_ht: number; tva: number; montant_ttc: number; id: string } | null;
}

export function FactureList({ factures, clients, fromDevis }: FactureListProps) {
  const [formOpen,     setFormOpen]     = useState(!!fromDevis);
  const [editing,      setEditing]      = useState<Facture | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  const [error,        setError]        = useState('');
  const [loadingPdf,   setLoadingPdf]   = useState<string | null>(null);

  const filtered = statusFilter === 'tous' ? factures : factures.filter((f) => f.statut === statusFilter);

  async function handleStatut(id: string, statut: 'payee' | 'partielle' | 'impayee' | 'envoyee') {
    setError('');
    const res = await changeFactureStatutAction(id, statut);
    if ('error' in res && res.error) setError(res.error);
  }

  async function handleAvoir(id: string) {
    setError('');
    const res = await creerAvoirAction(id);
    if ('error' in res && res.error) setError(res.error);
  }

  async function handlePDF(f: FactureWithClient) {
    setLoadingPdf(f.id);
    try {
      const res = await fetch(`/api/pdf?type=facture&id=${f.id}`);
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      await generatePDF(data);
    } catch (e) {
      setError('Erreur lors de la génération du PDF.');
    } finally {
      setLoadingPdf(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteFactureAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  const columns: Column<FactureWithClient>[] = [
    {
      key: 'num', header: 'N° Facture', sortable: true, sortValue: (r) => r.num,
      cell: (r) => (
        <div>
          <span className="font-mono text-sm font-medium text-oxi-text">{r.num}</span>
          {getRelance(r) && (
            <Badge variant={getRelance(r)!.variant} className="ml-2 text-xs">{getRelance(r)!.label}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'client', header: 'Client', sortable: true, sortValue: (r) => r.client_nom ?? '',
      cell: (r) => <span className="text-oxi-text-secondary">{r.client_nom ?? '—'}</span>,
    },
    {
      key: 'statut', header: 'Statut',
      cell: (r) => <Badge variant={factureVariant(r.statut)}>{factureLabel(r.statut)}</Badge>,
    },
    {
      key: 'montant_ttc', header: 'Total TTC', sortable: true, sortValue: (r) => r.montant_ttc,
      cell: (r) => <span className={['font-semibold', r.montant_ttc < 0 ? 'text-oxi-danger' : 'text-oxi-text'].join(' ')}>{fmtEur(r.montant_ttc)}</span>,
    },
    {
      key: 'echeance', header: 'Échéance', sortable: true, sortValue: (r) => r.echeance ?? '',
      cell: (r) => {
        const overdue = r.echeance && new Date(r.echeance) < new Date() && ['envoyee', 'impayee', 'partielle'].includes(r.statut);
        return <span className={`text-xs ${overdue ? 'font-medium text-oxi-danger' : 'text-oxi-text-muted'}`}>{r.echeance ? fmtDate(r.echeance) : '—'}</span>;
      },
      className: 'hidden md:table-cell',
    },
    {
      key: 'date', header: 'Date', sortable: true, sortValue: (r) => r.date,
      cell: (r) => <span className="text-xs text-oxi-text-muted">{fmtDate(r.date)}</span>,
      className: 'hidden lg:table-cell',
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={['rounded-full px-3 py-1 text-xs font-medium transition-colors', statusFilter === s ? 'bg-oxi-primary text-white' : 'bg-oxi-bg text-oxi-text-secondary hover:bg-oxi-border'].join(' ')}
            >
              {s === 'tous' ? 'Toutes' : factureLabel(s)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ExportCSV factures={filtered} />
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle facture
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchKeys={['num', 'client_nom'] as (keyof FactureWithClient)[]}
        searchPlaceholder="Rechercher par n° ou client…"
        emptyMessage="Aucune facture"
        emptyAction={
          <button onClick={() => setFormOpen(true)} className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors">
            Créer une facture
          </button>
        }
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* Marquer payée */}
            {['envoyee', 'partielle', 'impayee'].includes(row.statut) && (
              <button onClick={() => handleStatut(row.id, 'payee')} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-oxi-success bg-oxi-success-light hover:opacity-80 transition-opacity whitespace-nowrap">
                Payée
              </button>
            )}
            {/* Marquer partielle */}
            {['envoyee', 'impayee'].includes(row.statut) && (
              <button onClick={() => handleStatut(row.id, 'partielle')} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-oxi-warning bg-oxi-warning-light hover:opacity-80 transition-opacity whitespace-nowrap">
                Partielle
              </button>
            )}
            {/* PDF */}
            <button
              onClick={() => handlePDF(row)}
              disabled={loadingPdf === row.id}
              className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors disabled:opacity-40"
              title="Générer PDF"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </button>
            {/* Avoir */}
            {['payee', 'envoyee'].includes(row.statut) && (
              <button onClick={() => handleAvoir(row.id)} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors" title="Créer un avoir">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
              </button>
            )}
            {/* Modifier */}
            {['brouillon', 'envoyee'].includes(row.statut) && (
              <button onClick={() => { setEditing(row); setFormOpen(true); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors" title="Modifier">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
              </button>
            )}
            {/* Supprimer */}
            <button onClick={() => { setError(''); setDeleteId(row.id); }} className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors" title="Supprimer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      />

      <FactureForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        editing={editing}
        fromDevis={!editing ? fromDevis : null}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette facture ?"
        description="Cette action est irréversible."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
