'use client';

import { useState, useMemo } from 'react';

export interface Column<T> {
  key:       string;
  header:    string;
  cell:      (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  data:         T[];
  columns:      Column<T>[];
  keyExtractor: (row: T) => string;
  searchable?:  boolean;
  searchKeys?:  (keyof T)[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyAction?:  React.ReactNode;
  pageSize?:     number;
  actions?:      (row: T) => React.ReactNode;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  searchable = true,
  searchKeys = [],
  searchPlaceholder = 'Rechercher…',
  emptyMessage = 'Aucune donnée',
  emptyAction,
  pageSize = 25,
  actions,
}: DataTableProps<T>) {
  const [query,   setQuery]   = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page,    setPage]    = useState(1);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)),
    );
  }, [data, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged      = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      {/* Recherche */}
      {searchable && (
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oxi-text-muted" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-oxi-border bg-oxi-surface py-2 pl-9 pr-4 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none focus:border-oxi-primary focus:ring-2 focus:ring-oxi-primary/20 sm:max-w-xs"
          />
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-oxi-border shadow-oxi-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-oxi-border bg-[#F1F5F9]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-oxi-text-secondary',
                    col.sortable ? 'cursor-pointer select-none hover:text-oxi-text hover:bg-[#E8EEF5] transition-colors' : '',
                    col.className ?? '',
                  ].join(' ')}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    {col.header}
                    {col.sortable && (
                      <span className={sortKey === col.key ? 'text-oxi-primary' : 'text-oxi-text-muted'}>
                        {sortKey === col.key
                          ? sortDir === 'asc' ? '↑' : '↓'
                          : '↕'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-oxi-text-secondary">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-oxi-surface">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <p className="text-sm font-medium text-oxi-text-secondary">{emptyMessage}</p>
                  {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={keyExtractor(row)}
                  className={[
                    'border-b border-oxi-border-light transition-colors hover:bg-[#EFF6FF]',
                    idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white',
                  ].join(' ')}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={['px-4 py-3 text-oxi-text', col.className ?? ''].join(' ')}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-oxi-text-secondary">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} sur {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-oxi-border bg-oxi-surface px-3 py-1.5 text-sm hover:bg-oxi-bg disabled:opacity-40 transition-colors"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-sm font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-oxi-border bg-oxi-surface px-3 py-1.5 text-sm hover:bg-oxi-bg disabled:opacity-40 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
