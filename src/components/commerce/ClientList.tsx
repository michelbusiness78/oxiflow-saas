'use client';

import { useState, useMemo } from 'react';
import { ClientForm, type ClientFormClient } from './ClientForm';

export interface Client {
  id:                   string;
  nom:                  string;
  contact:              string;
  email:                string;
  tel:                  string;
  adresse:              string;
  cp:                   string;
  ville:                string;
  siret:                string;
  tva_intra:            string;
  conditions_paiement:  string;
  notes:                string;
  actif:                boolean;
  created_at:           string;
}

interface ClientListProps {
  clients:      Client[];
  onOpenFiche?: (id: string) => void;
}

type SortKey = 'nom' | 'contact' | 'ville';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function ClientList({ clients, onOpenFiche }: ClientListProps) {
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('nom');
  const [sortAsc,  setSortAsc]  = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<ClientFormClient | null>(null);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(e: React.MouseEvent, c: Client) {
    e.stopPropagation();
    setEditing({
      id:                   c.id,
      nom:                  c.nom            ?? '',
      contact:              c.contact        ?? '',
      email:                c.email          ?? '',
      tel:                  c.tel            ?? '',
      adresse:              c.adresse        ?? '',
      cp:                   c.cp             ?? '',
      ville:                c.ville          ?? '',
      siret:                c.siret          ?? '',
      tva_intra:            c.tva_intra      ?? '',
      conditions_paiement:  c.conditions_paiement ?? '',
      notes:                c.notes          ?? '',
      actif:                c.actif          ?? true,
    });
    setFormOpen(true);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = useMemo(() => {
    let list = clients;
    if (search.trim()) {
      const q = normalize(search.trim());
      list = list.filter((c) =>
        normalize(c.nom     ?? '').includes(q) ||
        normalize(c.contact ?? '').includes(q) ||
        normalize(c.ville   ?? '').includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = normalize(a[sortKey] ?? '');
      const bv = normalize(b[sortKey] ?? '');
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [clients, search, sortKey, sortAsc]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-blue-500">{sortAsc ? '↑' : '↓'}</span>;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau client
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mb-3 h-10 w-10 text-slate-300" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          {search ? (
            <p className="text-sm text-slate-500">Aucun client ne correspond à votre recherche.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Aucun client pour l'instant</p>
              <button onClick={openCreate} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                Ajouter votre premier client
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="cursor-pointer px-4 py-3 hover:text-slate-800 transition-colors" onClick={() => toggleSort('nom')}>
                  Nom <SortIcon col="nom" />
                </th>
                <th className="hidden cursor-pointer px-4 py-3 hover:text-slate-800 transition-colors sm:table-cell" onClick={() => toggleSort('contact')}>
                  Contact <SortIcon col="contact" />
                </th>
                <th className="hidden cursor-pointer px-4 py-3 hover:text-slate-800 transition-colors md:table-cell" onClick={() => toggleSort('ville')}>
                  Ville <SortIcon col="ville" />
                </th>
                <th className="hidden px-4 py-3 lg:table-cell">Téléphone</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onOpenFiche?.(c.id)}
                  className={`transition-colors hover:bg-slate-50 ${onOpenFiche ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{c.nom}</span>
                      {!c.actif && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">Inactif</span>
                      )}
                    </div>
                    {c.email && <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{c.contact || '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{[c.cp, c.ville].filter(Boolean).join(' ') || '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{c.tel || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => openEdit(e, c)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {search && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour « {search} »
            </p>
          )}
        </div>
      )}

      <ClientForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </>
  );
}
