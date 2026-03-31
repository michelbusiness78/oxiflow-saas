'use client';

/**
 * CatalogueSelector — composant autocomplete réutilisable
 *
 * Usage :
 *   <CatalogueSelector
 *     catalogue={catalogue}
 *     onSelect={({ reference, designation, prix_vente, tva, unite, type }) => ...}
 *     placeholder="Rechercher dans le catalogue…"
 *   />
 *
 * - Suggestions à partir de 3 caractères (référence ou désignation ou fournisseur)
 * - Sélection retourne les données utiles pour pré-remplir une ligne de devis
 * - Champ réinitialisé après sélection
 */

import { useState, useRef, useEffect } from 'react';
import type { CatalogueItem, CatalogueType } from '@/app/actions/catalogue';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogueSelectorResult {
  reference:   string;
  designation: string;
  prix_vente:  number;
  tva:         number;
  unite:       string;
  type:        CatalogueType;
}

interface CatalogueSelectorProps {
  catalogue:   CatalogueItem[];
  onSelect:    (item: CatalogueSelectorResult) => void;
  placeholder?: string;
  className?:   string;
}

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_CLS: Record<CatalogueType, string> = {
  materiel:    'bg-blue-100 text-blue-700',
  service:     'bg-purple-100 text-purple-700',
  forfait:     'bg-amber-100 text-amber-700',
  main_oeuvre: 'bg-orange-100 text-orange-700',
  fourniture:  'bg-slate-100 text-slate-600',
};

const TYPE_LABEL: Record<CatalogueType, string> = {
  materiel:    'Mat.',
  service:     'Svc',
  forfait:     'Forf.',
  main_oeuvre: 'MO',
  fourniture:  'Four.',
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CatalogueSelector({
  catalogue, onSelect, placeholder = 'Rechercher dans le catalogue…', className = '',
}: CatalogueSelectorProps) {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<CatalogueItem[]>([]);
  const [open,        setOpen]        = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function handleChange(value: string) {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const q = normalize(value.trim());
      const results = catalogue
        .filter((item) =>
          item.actif && (
            normalize(item.designation).includes(q) ||
            normalize(item.ref ?? '').includes(q) ||
            normalize(item.fournisseur ?? '').includes(q)
          )
        )
        .slice(0, 10);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 250);
  }

  function handleSelect(item: CatalogueItem) {
    onSelect({
      reference:   item.ref ?? '',
      designation: item.designation,
      prix_vente:  item.prix_vente,
      tva:         item.tva,
      unite:       item.unite,
      type:        item.type,
    });
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Effacer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(item)}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              {/* Badge type */}
              <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${TYPE_CLS[item.type] ?? 'bg-slate-100 text-slate-600'}`}>
                {TYPE_LABEL[item.type] ?? item.type}
              </span>

              {/* Désignation + ref */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{item.designation}</p>
                {item.ref && (
                  <p className="font-mono text-xs text-slate-400">{item.ref}</p>
                )}
              </div>

              {/* Prix / unité */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-700">
                  {item.prix_vente.toFixed(2)} €
                </p>
                <p className="text-xs text-slate-400">/ {item.unite}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim().length > 0 && query.trim().length < 3 && (
        <p className="absolute left-0 top-full mt-1 text-xs text-slate-400 px-1">
          Tapez au moins 3 caractères…
        </p>
      )}
    </div>
  );
}
