'use client';

import { useState, useMemo } from 'react';
import { QuoteForm, type QuoteWithClient, type TenantUser } from './QuoteForm';
import { duplicateQuoteAction, type QuoteStatut } from '@/app/actions/quotes';
import { fmtEur, fmtDate } from '@/lib/format';
import type { CatalogueItem } from '@/app/actions/catalogue';
import type { Invoice }       from '@/app/actions/invoices';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_META: Record<QuoteStatut, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600'   },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100 text-blue-700'     },
  accepte:   { label: 'Accepté',  cls: 'bg-green-100 text-green-700'   },
  refuse:    { label: 'Refusé',   cls: 'bg-red-100 text-red-600'       },
};

const STATUTS: Array<QuoteStatut | 'tous'> = ['tous', 'brouillon', 'envoye', 'accepte', 'refuse'];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuoteListProps {
  quotes:          QuoteWithClient[];
  clients:         { id: string; nom: string }[];
  catalogue:       CatalogueItem[];
  users:           TenantUser[];
  companies:       { id: string; name: string; color?: string }[];
  currentUserId:   string;
  currentUserName: string;
  invoices?:       Pick<Invoice, 'id' | 'number' | 'quote_id' | 'status'>[];
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function QuoteList({ quotes, clients, catalogue, users, companies, currentUserId, currentUserName, invoices }: QuoteListProps) {
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<QuoteWithClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuoteStatut | 'tous'>('tous');
  const [search,       setSearch]       = useState('');
  const [dupBusy,      setDupBusy]      = useState<string | null>(null);
  const [error,        setError]        = useState('');

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(q: QuoteWithClient) { setEditing(q); setFormOpen(true); }

  async function handleDuplicate(id: string) {
    setDupBusy(id);
    const res = await duplicateQuoteAction(id);
    setDupBusy(null);
    if (res.error) setError(res.error);
  }

  // Filtrage
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return quotes.filter((quote) => {
      if (statusFilter !== 'tous' && quote.statut !== statusFilter) return false;
      if (q && !(
        normalize(quote.number).includes(q) ||
        normalize(quote.client_nom ?? '').includes(q) ||
        normalize(quote.objet ?? '').includes(q)
      )) return false;
      return true;
    });
  }, [quotes, statusFilter, search]);

  // Compteurs par statut
  const counts = useMemo(() => {
    const c: Partial<Record<QuoteStatut | 'tous', number>> = { tous: quotes.length };
    for (const q of quotes) {
      c[q.statut] = (c[q.statut] ?? 0) + 1;
    }
    return c;
  }, [quotes]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Recherche */}
        <div className="relative min-w-0 flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° devis, client, objet…"
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
          Nouveau devis
        </button>
      </div>

      {/* Chips statut */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUTS.map((s) => {
          const count = counts[s] ?? 0;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? s === 'tous' ? 'bg-slate-800 text-white' : STATUT_META[s as QuoteStatut].cls + ' ring-2 ring-offset-1'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {s === 'tous' ? 'Tous' : STATUT_META[s as QuoteStatut].label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">{count}</span>
              )}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} devis
        </span>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400 mb-3">
            {search || statusFilter !== 'tous' ? 'Aucun résultat pour ces filtres.' : 'Aucun devis.'}
          </p>
          {!search && statusFilter === 'tous' && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Créer votre premier devis
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">N° Devis</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Objet</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Statut</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">HT</th>
                <th className="px-4 py-3 text-right">TTC</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Validité</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((q) => {
                const expired = q.validity && new Date(q.validity) < new Date() && q.statut === 'envoye';
                return (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(q)}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {q.number}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {q.client_nom}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                      {q.objet || '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUT_META[q.statut].cls}`}>
                        {STATUT_META[q.statut].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {fmtEur(q.montant_ht)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {fmtEur(q.montant_ttc)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      {fmtDate(q.date)}
                    </td>
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell whitespace-nowrap ${expired ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                      {q.validity ? fmtDate(q.validity) : '—'}
                      {expired && ' ⚠'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Dupliquer */}
                        <button
                          type="button"
                          disabled={dupBusy === q.id}
                          onClick={() => handleDuplicate(q.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors disabled:opacity-50"
                          title="Dupliquer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                          </svg>
                        </button>
                        {/* Modifier */}
                        <button
                          type="button"
                          onClick={() => openEdit(q)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors"
                          title="Ouvrir"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <QuoteForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        clients={clients}
        catalogue={catalogue}
        users={users}
        companies={companies}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        relatedInvoice={
          editing && invoices
            ? (invoices.find((i) => i.quote_id === editing.id) ?? null)
            : null
        }
      />
    </>
  );
}
