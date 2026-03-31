'use client';

import { useState, useMemo } from 'react';
import { CatalogueForm }   from './CatalogueForm';
import { CatalogueImport } from './CatalogueImport';
import { fmtEur } from '@/lib/format';
import type { CatalogueItem, CatalogueType } from '@/app/actions/catalogue';

// ─── Types helpers ────────────────────────────────────────────────────────────

const TYPE_META: Record<CatalogueType, { label: string; cls: string }> = {
  materiel:    { label: 'Matériel',     cls: 'bg-blue-100 text-blue-700'   },
  service:     { label: 'Service',      cls: 'bg-purple-100 text-purple-700' },
  forfait:     { label: 'Forfait',      cls: 'bg-amber-100 text-amber-700'  },
  main_oeuvre: { label: "Main d'œuvre", cls: 'bg-orange-100 text-orange-700' },
  fourniture:  { label: 'Fourniture',   cls: 'bg-slate-100 text-slate-600'   },
};

const TYPE_CHIP_ORDER: CatalogueType[] = ['materiel', 'service', 'forfait', 'main_oeuvre', 'fourniture'];

function TypeBadge({ type }: { type: CatalogueType }) {
  const meta = TYPE_META[type] ?? { label: type, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function fmtAchat(v: number | null) {
  if (v == null) return '—';
  return fmtEur(v);
}

function fmtMarge(achat: number | null, vente: number) {
  if (achat == null || vente <= 0) return '—';
  const pct = ((vente - achat) / vente) * 100;
  return { pct, cls: pct >= 30 ? 'text-green-600 font-semibold' : pct >= 15 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold' };
}

function unique<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((v): v is T => v != null && v !== ''))];
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface CatalogueListProps {
  catalogue: CatalogueItem[];
}

export function CatalogueList({ catalogue }: CatalogueListProps) {
  const [formOpen,   setFormOpen]   = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing,    setEditing]    = useState<CatalogueItem | null>(null);
  const [search,    setSearch]    = useState('');
  const [typeFilter,      setTypeFilter]      = useState<CatalogueType | ''>('');
  const [fournisseurFilter, setFournisseurFilter] = useState('');
  const [categorieFilter,   setCategorieFilter]   = useState('');

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(item: CatalogueItem) { setEditing(item); setFormOpen(true); }

  // Listes dynamiques pour filtres et autocomplete
  const fournisseurs = useMemo(() => unique(catalogue.map((c) => c.fournisseur)).sort(), [catalogue]);
  const categories   = useMemo(() => unique(catalogue.map((c) => c.categorie)).sort(), [catalogue]);

  // Types présents dans le catalogue (pour n'afficher que les chips pertinents)
  const typesPresents = useMemo(
    () => new Set(catalogue.map((c) => c.type)),
    [catalogue],
  );

  // Filtrage
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return catalogue.filter((item) => {
      if (q && !(
        normalize(item.designation).includes(q) ||
        normalize(item.ref ?? '').includes(q) ||
        normalize(item.fournisseur ?? '').includes(q)
      )) return false;
      if (typeFilter && item.type !== typeFilter) return false;
      if (fournisseurFilter && item.fournisseur !== fournisseurFilter) return false;
      if (categorieFilter && item.categorie !== categorieFilter) return false;
      return true;
    });
  }, [catalogue, search, typeFilter, fournisseurFilter, categorieFilter]);

  const hasFilters = !!typeFilter || !!fournisseurFilter || !!categorieFilter;

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
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Réf, désignation, fournisseur…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Filtres dropdown */}
        {fournisseurs.length > 0 && (
          <select
            value={fournisseurFilter}
            onChange={(e) => setFournisseurFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Tous les fournisseurs</option>
            {fournisseurs.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        {categories.length > 0 && (
          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau produit
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Importer
        </button>
      </div>

      {/* Chips type */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            typeFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
        >
          Tous
        </button>
        {TYPE_CHIP_ORDER.filter((t) => typesPresents.has(t)).map((t) => {
          const meta = TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                typeFilter === t ? meta.cls + ' ring-2 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {meta.label}
            </button>
          );
        })}

        {/* Compteur + reset */}
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
        </span>
        {hasFilters && (
          <button
            onClick={() => { setTypeFilter(''); setFournisseurFilter(''); setCategorieFilter(''); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400 mb-3">
            {search || hasFilters ? 'Aucun résultat pour ces filtres.' : 'Aucun produit dans le catalogue.'}
          </p>
          {!search && !hasFilters && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter votre premier produit
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">Réf</th>
                <th className="px-4 py-3 text-left">Désignation</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Fournisseur</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Catégorie</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">P. achat</th>
                <th className="px-4 py-3 text-right">P. vente</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Marge</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">TVA</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Unité</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const marge = fmtMarge(item.prix_achat, item.prix_vente);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(item)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {item.ref || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className={`font-medium ${!item.actif ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {item.designation}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-400 truncate">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell whitespace-nowrap">
                      {item.fournisseur || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {item.categorie || '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {fmtAchat(item.prix_achat)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {fmtEur(item.prix_vente)}
                    </td>
                    <td className={`px-4 py-3 text-right hidden md:table-cell whitespace-nowrap ${typeof marge === 'object' ? marge.cls : 'text-slate-400'}`}>
                      {typeof marge === 'object' ? `${marge.pct.toFixed(1)} %` : marge}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {item.tva} %
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {item.unite}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors"
                        title="Modifier"
                      >
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

      <CatalogueForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        fournisseurs={fournisseurs}
        categories={categories}
      />

      <CatalogueImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        catalogue={catalogue}
      />
    </>
  );
}
