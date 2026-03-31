'use client';

/**
 * CatalogueImport — Wizard d'import catalogue en 4 étapes
 * Step 1 : Upload fichier (CSV / XLSX)
 * Step 2 : Mapping colonnes + paramètres globaux
 * Step 3 : Prévisualisation + gestion doublons
 * Step 4 : Résultat import
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  importCatalogueAction,
  type ImportProductRow,
  type CatalogueType,
  type CatalogueItem,
} from '@/app/actions/catalogue';

// ─── Types internes ───────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;
type Row  = Record<string, string>;
type DuplicateMode = 'ignore' | 'update';

interface ParsedFile {
  name:    string;
  columns: string[];
  rows:    Row[];
}

interface MappingState {
  colRef:         string;
  colDesignation: string;
  colPrixAchat:   string;
  colCategorie:   string;
  colUnite:       string;
  fournisseur:    string;
  type:           CatalogueType;
  tva:            number;
  coefficient:    number;
}

interface MappedProduct extends ImportProductRow {
  isDuplicate: boolean;
  hasError:    boolean;
  errorMsg:    string;
}

interface ImportResult {
  imported: number;
  updated:  number;
  ignored:  number;
  error?:   string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parses a price string that may use French or US formatting */
function parsePrice(raw: string): number | null {
  if (!raw?.trim()) return null;
  // Replace French separators: "1 234,56" → "1234.56"
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') {
    const { default: Papa } = await import('papaparse');
    return new Promise((resolve, reject) => {
      Papa.parse<Row>(file, {
        header:         true,
        skipEmptyLines: true,
        complete: (r) =>
          resolve({ name: file.name, columns: r.meta.fields ?? [], rows: r.data }),
        error: reject,
      });
    });
  }

  // XLSX / XLS
  const XLSX = await import('xlsx');
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw  = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (!raw.length) return { name: file.name, columns: [], rows: [] };
  const columns = Object.keys(raw[0]);
  const rows: Row[] = raw.map((r) =>
    Object.fromEntries(columns.map((c) => [c, String(r[c] ?? '')])),
  );
  return { name: file.name, columns, rows };
}

function buildMappedProducts(
  rows:      Row[],
  mapping:   MappingState,
  existRefs: Set<string>,
): MappedProduct[] {
  return rows.map((row) => {
    const ref         = mapping.colRef         ? row[mapping.colRef]?.trim()         ?? '' : '';
    const designation = mapping.colDesignation ? row[mapping.colDesignation]?.trim() ?? '' : '';
    const rawAchat    = mapping.colPrixAchat   ? row[mapping.colPrixAchat]            : '';
    const categorie   = mapping.colCategorie   ? row[mapping.colCategorie]?.trim()   ?? '' : '';
    const unite       = mapping.colUnite       ? row[mapping.colUnite]?.trim()       || 'unité' : 'unité';

    const prix_achat  = parsePrice(rawAchat);
    const prix_vente  = prix_achat != null && mapping.coefficient > 0
      ? parseFloat((prix_achat * mapping.coefficient).toFixed(2))
      : 0;

    let hasError = false;
    let errorMsg = '';
    if (!designation) { hasError = true; errorMsg = 'Désignation vide'; }
    else if (prix_achat != null && prix_achat < 0) { hasError = true; errorMsg = 'Prix négatif'; }

    const isDuplicate = !!ref && existRefs.has(ref);

    return {
      ref,
      designation,
      fournisseur:   mapping.fournisseur,
      categorie,
      type:          mapping.type,
      prix_achat,
      prix_vente,
      tva:           mapping.tva,
      unite,
      imported_from: '',           // set before sending to server
      isDuplicate,
      hasError,
      errorMsg,
    };
  });
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const inputCls  = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const selectCls = inputCls;
const labelCls  = 'block text-sm font-semibold text-slate-700 mb-1';

// ─── Indicateur d'étapes ──────────────────────────────────────────────────────

const STEP_LABELS = ['Upload', 'Mapping', 'Aperçu', 'Import'];

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const n     = (i + 1) as Step;
        const done  = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all',
                done   ? 'bg-green-500 text-white'
                : active ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-slate-100 text-slate-400',
              ].join(' ')}>
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : n}
              </div>
              <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`mx-2 mb-4 h-0.5 w-8 sm:w-16 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ÉTAPE 1 — Upload ─────────────────────────────────────────────────────────

function Step1Upload({
  parsed, onParsed,
}: {
  parsed:   ParsedFile | null;
  onParsed: (f: ParsedFile) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const ACCEPT = '.csv,.xlsx,.xls';

  async function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setErr('Format non supporté. Utilisez .csv, .xlsx ou .xls');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const result = await parseFile(file);
      if (result.rows.length === 0) { setErr('Le fichier semble vide.'); return; }
      onParsed(result);
    } catch {
      setErr('Erreur lors de la lecture du fichier.');
    } finally {
      setLoading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Zone drag & drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300',
        ].join(' ')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mb-3 h-10 w-10 text-slate-300" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-slate-600">
          Déposez votre fichier ici
        </p>
        <p className="mt-1 text-xs text-slate-400">.csv, .xlsx, .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {loading ? 'Lecture en cours…' : 'Parcourir'}
        </button>
      </div>

      {err && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-4 py-3">{err}</p>}

      {/* Aperçu fichier */}
      {parsed && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-green-500" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-slate-800">{parsed.name}</p>
              <p className="text-xs text-slate-400">
                {parsed.rows.length} ligne{parsed.rows.length !== 1 ? 's' : ''} détectée{parsed.rows.length !== 1 ? 's' : ''} · {parsed.columns.length} colonne{parsed.columns.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-auto text-xs text-blue-600 hover:underline"
            >
              Changer
            </button>
          </div>
          {/* 5 premières lignes */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  {parsed.columns.slice(0, 8).map((col) => (
                    <th key={col} className="px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{col}</th>
                  ))}
                  {parsed.columns.length > 8 && <th className="px-3 py-2 text-slate-400">…</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="text-slate-600">
                    {parsed.columns.slice(0, 8).map((col) => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap max-w-[120px] truncate">{row[col] ?? ''}</td>
                    ))}
                    {parsed.columns.length > 8 && <td className="px-3 py-1.5 text-slate-400">…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 5 && (
            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
              + {parsed.rows.length - 5} ligne{parsed.rows.length - 5 > 1 ? 's' : ''} supplémentaire{parsed.rows.length - 5 > 1 ? 's' : ''}…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ÉTAPE 2 — Mapping ────────────────────────────────────────────────────────

const NONE = '— Ignorer —';

function ColSelect({
  label, value, onChange, columns, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  columns: string[]; required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {!required && <option value="">{NONE}</option>}
        {required  && <option value="">— Sélectionner —</option>}
        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function Step2Mapping({
  columns, mapping, onChange,
}: {
  columns: string[];
  mapping: MappingState;
  onChange: (k: keyof MappingState, v: MappingState[keyof MappingState]) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Mapping colonnes */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Correspondance des colonnes</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColSelect label="Référence produit" value={mapping.colRef} onChange={(v) => onChange('colRef', v)} columns={columns} required />
          <ColSelect label="Désignation" value={mapping.colDesignation} onChange={(v) => onChange('colDesignation', v)} columns={columns} required />
          <ColSelect label="Prix achat HT" value={mapping.colPrixAchat} onChange={(v) => onChange('colPrixAchat', v)} columns={columns} />
          <ColSelect label="Catégorie" value={mapping.colCategorie} onChange={(v) => onChange('colCategorie', v)} columns={columns} />
          <ColSelect label="Unité" value={mapping.colUnite} onChange={(v) => onChange('colUnite', v)} columns={columns} />
        </div>
      </div>

      {/* Paramètres globaux */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Paramètres appliqués à toutes les lignes</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Fournisseur */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Fournisseur <span className="text-red-500">*</span>
            </label>
            <input
              value={mapping.fournisseur}
              onChange={(e) => onChange('fournisseur', e.target.value)}
              placeholder="Axis, Cisco, Hikvision…"
              className={inputCls}
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelCls}>Type par défaut</label>
            <div className="flex gap-2">
              {(['materiel', 'service', 'forfait'] as CatalogueType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange('type', t)}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    mapping.type === t
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300',
                  ].join(' ')}
                >
                  {t === 'materiel' ? 'Matériel' : t === 'service' ? 'Service' : 'Forfait'}
                </button>
              ))}
            </div>
          </div>

          {/* TVA */}
          <div>
            <label className={labelCls}>TVA par défaut</label>
            <select
              value={mapping.tva}
              onChange={(e) => onChange('tva', parseFloat(e.target.value))}
              className={selectCls}
            >
              {[20, 10, 5.5, 0].map((v) => (
                <option key={v} value={v}>{v} %</option>
              ))}
            </select>
          </div>

          {/* Coefficient */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Coefficient de marge{' '}
              <span className="font-normal text-slate-400">(prix_vente = prix_achat × coeff.)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={mapping.coefficient}
                onChange={(e) => onChange('coefficient', parseFloat(e.target.value) || 1)}
                className={`${inputCls} max-w-[120px]`}
              />
              {mapping.coefficient !== 1 && (
                <span className="text-sm text-slate-500">
                  = {((mapping.coefficient - 1) * 100).toFixed(0)} % de marge brute
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ÉTAPE 3 — Prévisualisation ───────────────────────────────────────────────

function Step3Preview({
  products, mode, onModeChange,
}: {
  products:     MappedProduct[];
  mode:         DuplicateMode;
  onModeChange: (m: DuplicateMode) => void;
}) {
  const total      = products.length;
  const errors     = products.filter((p) => p.hasError).length;
  const duplicates = products.filter((p) => !p.hasError && p.isDuplicate).length;
  const toImport   = products.filter((p) => !p.hasError && (!p.isDuplicate || mode === 'update')).length;

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <span className="font-bold text-blue-700">{toImport}</span>
          <span className="ml-1.5 text-blue-600">à importer</span>
        </div>
        {duplicates > 0 && (
          <div className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm">
            <span className="font-bold text-amber-700">{duplicates}</span>
            <span className="ml-1.5 text-amber-600">doublon{duplicates > 1 ? 's' : ''}</span>
          </div>
        )}
        {errors > 0 && (
          <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm">
            <span className="font-bold text-red-700">{errors}</span>
            <span className="ml-1.5 text-red-600">erreur{errors > 1 ? 's' : ''} (ignorée{errors > 1 ? 's' : ''})</span>
          </div>
        )}
        <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
          {total} ligne{total > 1 ? 's' : ''} au total
        </div>
      </div>

      {/* Mode doublons */}
      {duplicates > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">{duplicates} doublon{duplicates > 1 ? 's' : ''} détecté{duplicates > 1 ? 's' : ''}</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dupMode" checked={mode === 'ignore'} onChange={() => onModeChange('ignore')} className="accent-amber-600" />
              <span className="text-sm text-amber-700">Ignorer les doublons</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dupMode" checked={mode === 'update'} onChange={() => onModeChange('update')} className="accent-amber-600" />
              <span className="text-sm text-amber-700">Mettre à jour les prix</span>
            </label>
          </div>
        </div>
      )}

      {/* Tableau preview */}
      <div className="overflow-auto max-h-72 rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="px-3 py-2 text-left">Réf</th>
              <th className="px-3 py-2 text-left">Désignation</th>
              <th className="px-3 py-2 text-left hidden sm:table-cell">Fournisseur</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">P. achat</th>
              <th className="px-3 py-2 text-right">P. vente</th>
              <th className="px-3 py-2 text-center">TVA</th>
              <th className="px-3 py-2 text-left hidden sm:table-cell">Unité</th>
              <th className="px-3 py-2 text-left">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p, i) => (
              <tr
                key={i}
                className={
                  p.hasError    ? 'bg-red-50 opacity-70'
                  : p.isDuplicate ? 'bg-amber-50'
                  : ''
                }
              >
                <td className="px-3 py-1.5 font-mono text-slate-400">{p.ref || '—'}</td>
                <td className={`px-3 py-1.5 max-w-[140px] truncate ${p.hasError ? 'text-red-600' : 'text-slate-800 font-medium'}`}>
                  {p.designation || <span className="italic text-red-400">Vide</span>}
                </td>
                <td className="px-3 py-1.5 text-slate-500 hidden sm:table-cell">{p.fournisseur}</td>
                <td className="px-3 py-1.5 text-right text-slate-500 hidden md:table-cell">
                  {p.prix_achat != null ? `${p.prix_achat.toFixed(2)} €` : '—'}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-slate-700">
                  {p.prix_vente > 0 ? `${p.prix_vente.toFixed(2)} €` : '—'}
                </td>
                <td className="px-3 py-1.5 text-center text-slate-500">{p.tva} %</td>
                <td className="px-3 py-1.5 text-slate-500 hidden sm:table-cell">{p.unite}</td>
                <td className="px-3 py-1.5">
                  {p.hasError && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                      {p.errorMsg}
                    </span>
                  )}
                  {!p.hasError && p.isDuplicate && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Doublon
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ÉTAPE 4 — Résultat ───────────────────────────────────────────────────────

function Step4Result({
  importing, result,
}: {
  importing: boolean;
  result:    ImportResult | null;
}) {
  if (importing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm font-medium text-slate-600">Import en cours…</p>
        {/* Barre animée */}
        <div className="w-full max-w-xs overflow-hidden rounded-full bg-slate-100 h-2">
          <div className="h-2 w-1/2 rounded-full bg-blue-600 animate-pulse" />
        </div>
        <p className="text-xs text-slate-400">Veuillez patienter, insertion en base…</p>
      </div>
    );
  }

  if (!result) return null;

  if (result.error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center">
        <p className="text-base font-semibold text-red-700">Erreur lors de l'import</p>
        <p className="mt-2 text-sm text-red-600">{result.error}</p>
      </div>
    );
  }

  const total = result.imported + result.updated + result.ignored;

  return (
    <div className="flex flex-col items-center py-8 gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8 text-green-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-800">Import terminé</p>
        <p className="mt-1 text-sm text-slate-500">{total} ligne{total !== 1 ? 's' : ''} traitée{total !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {result.imported > 0 && (
          <div className="rounded-xl bg-green-50 px-6 py-4 text-center">
            <p className="text-2xl font-bold text-green-600">{result.imported}</p>
            <p className="text-sm text-green-700">importé{result.imported > 1 ? 's' : ''}</p>
          </div>
        )}
        {result.updated > 0 && (
          <div className="rounded-xl bg-blue-50 px-6 py-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
            <p className="text-sm text-blue-700">mis à jour</p>
          </div>
        )}
        {result.ignored > 0 && (
          <div className="rounded-xl bg-slate-100 px-6 py-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{result.ignored}</p>
            <p className="text-sm text-slate-600">ignoré{result.ignored > 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

interface CatalogueImportProps {
  open:      boolean;
  onClose:   () => void;
  catalogue: CatalogueItem[];   // pour la détection des doublons côté client
}

const defaultMapping: MappingState = {
  colRef:         '',
  colDesignation: '',
  colPrixAchat:   '',
  colCategorie:   '',
  colUnite:       '',
  fournisseur:    '',
  type:           'materiel',
  tva:            20,
  coefficient:    1.0,
};

export function CatalogueImport({ open, onClose, catalogue }: CatalogueImportProps) {
  const [step,      setStep]      = useState<Step>(1);
  const [parsed,    setParsed]    = useState<ParsedFile | null>(null);
  const [mapping,   setMapping]   = useState<MappingState>(defaultMapping);
  const [dupMode,   setDupMode]   = useState<DuplicateMode>('ignore');
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);

  // Refs existants pour détection client-side
  const existRefs = useMemo(
    () => new Set(catalogue.map((c) => c.ref).filter(Boolean) as string[]),
    [catalogue],
  );

  // Produits mappés (calculés au step 3)
  const mappedProducts = useMemo<MappedProduct[]>(() => {
    if (!parsed || step < 3) return [];
    return buildMappedProducts(parsed.rows, mapping, existRefs);
  }, [parsed, mapping, existRefs, step]);

  const toImportCount = mappedProducts.filter(
    (p) => !p.hasError && (!p.isDuplicate || dupMode === 'update'),
  ).length;

  function updateMapping(k: keyof MappingState, v: MappingState[keyof MappingState]) {
    setMapping((m) => ({ ...m, [k]: v }));
  }

  function reset() {
    setStep(1);
    setParsed(null);
    setMapping(defaultMapping);
    setDupMode('ignore');
    setImporting(false);
    setResult(null);
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  // Validation step 2
  const step2Valid = !!mapping.colRef && !!mapping.colDesignation && !!mapping.fournisseur.trim();

  async function handleImport() {
    const products: ImportProductRow[] = mappedProducts
      .filter((p) => !p.hasError && (!p.isDuplicate || dupMode === 'update'))
      .map(({ isDuplicate: _, hasError: __, errorMsg: ___, ...p }) => ({
        ...p,
        imported_from: parsed!.name,
      }));

    if (products.length === 0) return;

    setStep(4);
    setImporting(true);
    const res = await importCatalogueAction(products, dupMode);
    setImporting(false);
    setResult(res);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 pt-8 pb-8">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Importer un catalogue</h2>
            <p className="text-xs text-slate-400 mt-0.5">CSV, XLSX — détection automatique des colonnes</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center border-b border-slate-200 px-6 py-4">
          <StepIndicator step={step} />
        </div>

        {/* Corps */}
        <div className="min-h-[300px] p-6">
          {step === 1 && (
            <Step1Upload parsed={parsed} onParsed={(f) => { setParsed(f); }} />
          )}
          {step === 2 && parsed && (
            <Step2Mapping columns={parsed.columns} mapping={mapping} onChange={updateMapping} />
          )}
          {step === 3 && (
            <Step3Preview products={mappedProducts} mode={dupMode} onModeChange={setDupMode} />
          )}
          {step === 4 && (
            <Step4Result importing={importing} result={result} />
          )}
        </div>

        {/* Footer */}
        {step !== 4 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : handleClose()}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {step === 1 ? 'Annuler' : '← Précédent'}
            </button>

            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={
                  (step === 1 && (!parsed || parsed.rows.length === 0)) ||
                  (step === 2 && !step2Valid)
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant →
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleImport}
                disabled={toImportCount === 0}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Importer {toImportCount} produit{toImportCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Footer step 4 — Fermer */}
        {step === 4 && !importing && (
          <div className="border-t border-slate-200 px-6 py-4 flex justify-center">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
