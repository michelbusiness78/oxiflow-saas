'use client';

import { useState } from 'react';
import { CatalogueForm } from './CatalogueForm';
import { fmtEur } from '@/lib/format';
import type { CatalogueItem, CatalogueType } from '@/app/actions/catalogue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<CatalogueType, string> = {
  materiel:    'bg-blue-100   text-blue-700',
  service:     'bg-green-100  text-green-700',
  main_oeuvre: 'bg-orange-100 text-orange-700',
  fourniture:  'bg-purple-100 text-purple-700',
};

const TYPE_LABELS: Record<CatalogueType, string> = {
  materiel:    'Matériel',
  service:     'Service',
  main_oeuvre: "Main d'œuvre",
  fourniture:  'Fourniture',
};

const UNITE_LABELS: Record<string, string> = {
  u:      'unité',
  h:      'heure',
  j:      'jour',
  ml:     'ml',
  m2:     'm²',
  kg:     'kg',
  forfait:'forfait',
};

function calcMarge(achat: number, vente: number): number | null {
  if (vente <= 0) return null;
  return ((vente - achat) / vente) * 100;
}

function margeCls(pct: number | null): string {
  if (pct === null) return 'text-oxi-text-muted';
  if (pct >= 30)   return 'font-semibold text-green-600';
  if (pct >= 15)   return 'font-semibold text-orange-500';
  return 'font-semibold text-red-500';
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface CatalogueListProps {
  catalogue: CatalogueItem[];
}

export function CatalogueList({ catalogue }: CatalogueListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<CatalogueItem | null>(null);
  const [search,   setSearch]   = useState('');

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(item: CatalogueItem) { setEditing(item); setFormOpen(true); }

  const filtered = search.trim()
    ? catalogue.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.designation.toLowerCase().includes(q) ||
          (p.ref ?? '').toLowerCase().includes(q)
        );
      })
    : catalogue;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <svg
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.75} stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-oxi-text-muted pointer-events-none"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher désignation, réf…"
            className="w-full rounded-lg border border-oxi-border bg-oxi-bg py-2 pl-9 pr-3 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
          />
        </div>

        <p className="text-sm text-oxi-text-secondary shrink-0">
          {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
        </p>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau produit
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-oxi-border py-12 text-center">
          <p className="text-sm text-oxi-text-muted mb-3">
            {search ? 'Aucun résultat pour cette recherche.' : 'Aucun produit dans le catalogue.'}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-oxi-primary px-4 py-2 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
            >
              Ajouter votre premier produit
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-oxi-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oxi-border bg-oxi-bg text-xs font-semibold uppercase tracking-wider text-oxi-text-muted">
                <th className="px-4 py-3 text-left">Réf</th>
                <th className="px-4 py-3 text-left">Désignation</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">P. achat</th>
                <th className="px-4 py-3 text-right">P. vente</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Marge</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">TVA</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Unité</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-oxi-border bg-oxi-surface">
              {filtered.map((item) => {
                const marge    = calcMarge(item.prix_achat, item.prix_vente);
                const typeKey  = item.type as CatalogueType;
                return (
                  <tr key={item.id} className="hover:bg-oxi-bg/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-oxi-text-muted whitespace-nowrap">
                      {item.ref || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-medium ${!item.actif ? 'text-oxi-text-muted line-through' : 'text-oxi-text'}`}>
                        {item.designation}
                      </p>
                      {item.description && (
                        <p className="text-xs text-oxi-text-muted truncate max-w-[200px]">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[typeKey] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[typeKey] ?? item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-oxi-text-secondary hidden md:table-cell whitespace-nowrap">
                      {fmtEur(item.prix_achat)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-oxi-text whitespace-nowrap">
                      {fmtEur(item.prix_vente)}
                    </td>
                    <td className={`px-4 py-3 text-right hidden md:table-cell whitespace-nowrap ${margeCls(marge)}`}>
                      {marge !== null ? `${marge.toFixed(1)} %` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-oxi-text-secondary hidden lg:table-cell">
                      {item.tva} %
                    </td>
                    <td className="px-4 py-3 text-center text-oxi-text-secondary hidden lg:table-cell">
                      {UNITE_LABELS[item.unite] ?? item.unite}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-md p-1.5 text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors"
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
      />
    </>
  );
}
