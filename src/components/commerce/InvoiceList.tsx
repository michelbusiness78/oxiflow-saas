'use client';

import { useState, useMemo } from 'react';
import { InvoiceForm }        from './InvoiceForm';
import { fmtEur, fmtDate }    from '@/lib/format';
import type { Invoice, InvoiceStatus } from '@/app/actions/invoices';
import type { CatalogueItem }          from '@/app/actions/catalogue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600'  },
  emise:     { label: 'Émise',     cls: 'bg-blue-100 text-blue-700'    },
  payee:     { label: 'Payée',     cls: 'bg-green-100 text-green-700'  },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-600'      },
};

const FILTERS: Array<InvoiceStatus | 'tous'> = ['tous', 'brouillon', 'emise', 'payee', 'en_retard'];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function retardDays(inv: Invoice): number {
  if (inv.status !== 'en_retard' || !inv.date_echeance) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(inv.date_echeance).getTime()) / 86_400_000));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceListProps {
  invoices:  Invoice[];
  clients:   { id: string; nom: string }[];
  catalogue: CatalogueItem[];
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function InvoiceList({ invoices, clients, catalogue }: InvoiceListProps) {
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'tous'>('tous');
  const [search,       setSearch]       = useState('');

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(inv: Invoice) { setEditing(inv); setFormOpen(true); }

  // Compteurs par statut
  const counts = useMemo(() => {
    const c: Partial<Record<InvoiceStatus | 'tous', number>> = { tous: invoices.length };
    for (const inv of invoices) {
      c[inv.status] = (c[inv.status] ?? 0) + 1;
    }
    return c;
  }, [invoices]);

  // Filtrage + recherche
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return invoices.filter((inv) => {
      if (statusFilter !== 'tous' && inv.status !== statusFilter) return false;
      if (q && !(
        normalize(inv.number).includes(q) ||
        normalize(inv.client_nom ?? '').includes(q) ||
        normalize(inv.quote_number ?? '').includes(q)
      )) return false;
      return true;
    });
  }, [invoices, statusFilter, search]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° facture, client, N° devis…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* Chips statut */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((s) => {
          const count  = counts[s] ?? 0;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? s === 'tous'
                    ? 'bg-slate-800 text-white'
                    : STATUS_META[s as InvoiceStatus].cls + ' ring-2 ring-offset-1'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {s === 'tous' ? 'Toutes' : STATUS_META[s as InvoiceStatus].label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">{count}</span>}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">{filtered.length} facture{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400 mb-3">
            {search || statusFilter !== 'tous' ? 'Aucun résultat pour ces filtres.' : 'Aucune facture.'}
          </p>
          {!search && statusFilter === 'tous' && (
            <button onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Créer une facture
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">N° Facture</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Statut</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Échéance</th>
                <th className="px-4 py-3 text-right">TTC</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const jours = retardDays(inv);
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(inv)}
                  >
                    {/* N° + badges */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {inv.number}
                        </span>
                        {inv.quote_number && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 whitespace-nowrap">
                            ← {inv.quote_number}
                          </span>
                        )}
                        {inv.status === 'en_retard' && jours > 0 && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 whitespace-nowrap">
                            J+{jours}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {inv.client_nom}
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[inv.status].cls}`}>
                        {STATUS_META[inv.status].label}
                      </span>
                    </td>

                    {/* Date facture */}
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
                      {fmtDate(inv.date_facture)}
                    </td>

                    {/* Échéance */}
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell whitespace-nowrap ${inv.status === 'en_retard' ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
                      {fmtDate(inv.date_echeance)}
                    </td>

                    {/* Montant TTC */}
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-800 whitespace-nowrap">
                      {fmtEur(inv.total_ttc)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openEdit(inv)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors"
                        title="Ouvrir">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        clients={clients}
        catalogue={catalogue}
      />
    </>
  );
}
