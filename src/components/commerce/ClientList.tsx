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
  clients: Client[];
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function ClientList({ clients }: ClientListProps) {
  const [search,   setSearch]   = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<ClientFormClient | null>(null);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(c: Client) {
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

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = normalize(search.trim());
    return clients.filter((c) =>
      normalize(c.nom     ?? '').includes(q) ||
      normalize(c.contact ?? '').includes(q) ||
      normalize(c.ville   ?? '').includes(q)
    );
  }, [clients, search]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Barre de recherche */}
        <div className="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          >
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

      {/* Compteur */}
      {search && (
        <p className="text-sm text-slate-500">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour « {search} »
        </p>
      )}

      {/* Grille de cartes */}
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
              <button
                onClick={openCreate}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Ajouter votre premier client
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openEdit(c)}
              className="group text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {/* Nom + badge actif */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                  {c.nom}
                </p>
                {!c.actif && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                    Inactif
                  </span>
                )}
              </div>

              {/* Contact */}
              {c.contact && (
                <p className="mt-1 text-sm text-slate-500">{c.contact}</p>
              )}

              {/* Ville */}
              {(c.cp || c.ville) && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {[c.cp, c.ville].filter(Boolean).join(' ')}
                </p>
              )}

              {/* Téléphone */}
              {c.tel && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  {c.tel}
                </p>
              )}
            </button>
          ))}
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
