'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO, addDays } from '@/lib/format';
import {
  createDevisAction,
  updateDevisAction,
  type DevisInput,
  type DevisLigne,
} from '@/app/actions/commerce';
import type { CatalogueItem } from '@/app/actions/catalogue';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; nom: string; }

export interface Devis {
  id:          string;
  num:         string;
  client_id:   string;
  date:        string;
  validite:    string;
  statut:      string;
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
}

interface DevisFormProps {
  open:      boolean;
  onClose:   () => void;
  clients:   Client[];
  catalogue?: CatalogueItem[];
  editing?:  Devis | null;
}

// ─── Ligne vide ───────────────────────────────────────────────────────────────

type LigneLocal = DevisLigne & { _id: string };

function newLigne(): LigneLocal {
  return {
    _id:         crypto.randomUUID(),
    designation: '',
    quantite:    1,
    prix_ht:     0,
    tva_pct:     20,
    remise_pct:  0,
  };
}

// ─── Calcul totaux ────────────────────────────────────────────────────────────

function calcLigne(l: LigneLocal) {
  const ht  = l.quantite * l.prix_ht * (1 - l.remise_pct / 100);
  const tva = ht * l.tva_pct / 100;
  return { ht, tva, ttc: ht + tva };
}

function calcTotaux(lignes: LigneLocal[]) {
  const rows = lignes.map(calcLigne);
  const ht  = rows.reduce((s, r) => s + r.ht,  0);
  const tva = rows.reduce((s, r) => s + r.tva, 0);
  return { ht, tva, ttc: ht + tva };
}

// ─── Champ texte / numérique simple ──────────────────────────────────────────

function Input({
  value, onChange, onBlur, type = 'text', placeholder = '', className = '',
  min, max, step, required,
}: {
  value: string | number; onChange: (v: string) => void; onBlur?: () => void;
  type?: string; placeholder?: string; className?: string;
  min?: string; max?: string; step?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onFocus={type === 'number' ? (e) => e.target.select() : undefined}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      required={required}
      className={[
        'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
        'outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
        'placeholder:text-slate-400',
        className,
      ].join(' ')}
    />
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

type AutocompleteState = { ligneId: string; results: CatalogueItem[] } | null;

export function DevisForm({ open, onClose, clients, catalogue, editing }: DevisFormProps) {
  const today = todayISO();

  const initLignes = useCallback((): LigneLocal[] => {
    if (editing?.lignes?.length) {
      return editing.lignes.map((l) => ({ ...l, _id: crypto.randomUUID() }));
    }
    return [newLigne()];
  }, [editing]);

  const [clientId,  setClientId]  = useState(editing?.client_id ?? '');
  const [date,      setDate]      = useState(editing?.date      ?? today);
  const [validite,  setValidite]  = useState(editing?.validite  ?? addDays(today, 30));
  const [lignes,    setLignes]    = useState<LigneLocal[]>(initLignes);
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);

  // ── Autocomplétion catalogue ────────────────────────────────────────────────
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage du timer au démontage
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Re-sync tous les states à chaque ouverture du panneau.
  useEffect(() => {
    if (!open) return;
    const t = todayISO();
    setClientId(editing?.client_id ?? '');
    setDate(editing?.date     ?? t);
    setValidite(editing?.validite ?? addDays(t, 30));
    setLignes(
      editing?.lignes?.length
        ? editing.lignes.map((l) => ({ ...l, _id: crypto.randomUUID() }))
        : [newLigne()],
    );
    setError('');
    setSaving(false);
    setAutocomplete(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totaux = useMemo(() => calcTotaux(lignes), [lignes]);

  function updateLigne(id: string, key: keyof LigneLocal, raw: string) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l._id !== id) return l;
        const num = ['quantite', 'prix_ht', 'tva_pct', 'remise_pct'].includes(key)
          ? parseFloat(raw) || 0
          : raw;
        return { ...l, [key]: num };
      }),
    );
  }

  // Déclenche la recherche catalogue avec debounce 300ms
  function handleDesignationChange(ligneId: string, value: string) {
    updateLigne(ligneId, 'designation', value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim() || !catalogue?.length) {
      setAutocomplete(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const q = value.toLowerCase();
      const results = catalogue
        .filter((p) =>
          p.actif &&
          (p.designation.toLowerCase().includes(q) ||
           (p.ref ?? '').toLowerCase().includes(q))
        )
        .slice(0, 8);
      setAutocomplete({ ligneId, results });
    }, 300);
  }

  // Sélection d'un produit du catalogue → remplit la ligne
  function selectFromCatalogue(ligneId: string, item: CatalogueItem) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l._id !== ligneId) return l;
        return {
          ...l,
          designation: item.designation,
          prix_ht:     item.prix_vente,
          tva_pct:     item.tva,
        };
      }),
    );
    setAutocomplete(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function addLigne() { setLignes((p) => [...p, newLigne()]); }
  function removeLigne(id: string) {
    if (lignes.length > 1) setLignes((p) => p.filter((l) => l._id !== id));
  }

  async function save(statut: 'brouillon' | 'envoye') {
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    if (lignes.some((l) => !l.designation.trim())) {
      setError('Chaque ligne doit avoir une désignation.');
      return;
    }
    setSaving(true);
    setError('');

    const input: DevisInput = {
      client_id:   clientId,
      date,
      validite,
      statut,
      lignes:      lignes.map(({ _id: _, ...rest }) => rest),
      montant_ht:  parseFloat(totaux.ht.toFixed(2)),
      tva:         parseFloat(totaux.tva.toFixed(2)),
      montant_ttc: parseFloat(totaux.ttc.toFixed(2)),
    };

    const res = editing
      ? await updateDevisAction(editing.id, input)
      : await createDevisAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Render champ désignation avec dropdown autocomplete ──────────────────────

  function renderDesignation(ligne: LigneLocal, placeholder: string, extraCls = '') {
    const isOpen = autocomplete?.ligneId === ligne._id;
    return (
      <div className="relative">
        <Input
          value={ligne.designation}
          onChange={(v) => handleDesignationChange(ligne._id, v)}
          onBlur={() => setTimeout(() => setAutocomplete(null), 150)}
          placeholder={placeholder}
          className={`w-full ${extraCls}`}
          required
        />
        {isOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-sm shadow-lg overflow-hidden">
            {autocomplete!.results.length > 0 ? (
              autocomplete!.results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // empêche onBlur de se déclencher avant onClick
                  onClick={() => selectFromCatalogue(ligne._id, item)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white transition-colors"
                >
                  <span className="flex-1 truncate text-slate-800">{item.designation}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {item.ref ? <span className="font-mono mr-2">{item.ref}</span> : null}
                    {item.prix_vente > 0 ? `${item.prix_vente.toFixed(2)} €` : ''}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-400">
                Aucun produit trouvé — saisie libre
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={editing ? `Modifier ${editing.num}` : 'Nouveau devis'}
      width="xl"
    >
      <div className="flex flex-col gap-0">
        <div className="space-y-5 p-5">
          {error && (
            <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
              {error}
            </div>
          )}

          {/* Client + Dates */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <label className="block text-sm font-semibold text-slate-700">
                Client <span className="text-oxi-danger">*</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Date</label>
              <Input type="date" value={date} onChange={setDate} className="w-full" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Validité</label>
              <Input type="date" value={validite} onChange={setValidite} className="w-full" />
            </div>
          </div>

          {/* Lignes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Lignes</h3>
              <button
                type="button"
                onClick={addLigne}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>
            </div>

            {/* En-têtes colonnes */}
            <div className="hidden grid-cols-[1fr_80px_90px_60px_60px_36px] gap-2 mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid">
              <span>Désignation</span>
              <span>Qté</span>
              <span>PU HT (€)</span>
              <span>TVA %</span>
              <span>Rem. %</span>
              <span />
            </div>

            <div className="space-y-2">
              {lignes.map((ligne, i) => {
                const { ht } = calcLigne(ligne);
                return (
                  <div key={ligne._id} className="rounded-lg border border-slate-200 bg-white p-3">
                    {/* Mobile : empilé */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      {renderDesignation(ligne, `Désignation ligne ${i + 1}`)}
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="number" value={ligne.quantite}   onChange={(v) => updateLigne(ligne._id, 'quantite',   v)} placeholder="Qté"  min="0" step="0.01" className="w-full" />
                        <Input type="number" value={ligne.prix_ht}    onChange={(v) => updateLigne(ligne._id, 'prix_ht',    v)} placeholder="PU HT" min="0" step="0.01" className="w-full" />
                        <Input type="number" value={ligne.tva_pct}    onChange={(v) => updateLigne(ligne._id, 'tva_pct',    v)} placeholder="TVA %" min="0" step="0.1"  className="w-full" />
                        <Input type="number" value={ligne.remise_pct} onChange={(v) => updateLigne(ligne._id, 'remise_pct', v)} placeholder="Rem %" min="0" max="100" step="0.1" className="w-full" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Sous-total HT : <strong>{fmtEur(ht)}</strong></span>
                        <button type="button" onClick={() => removeLigne(ligne._id)} className="text-oxi-danger hover:underline text-xs">Supprimer</button>
                      </div>
                    </div>

                    {/* Desktop : grille */}
                    <div className="hidden items-center gap-2 sm:grid sm:grid-cols-[1fr_80px_90px_60px_60px_36px]">
                      {renderDesignation(ligne, `Ligne ${i + 1}`)}
                      <Input type="number" value={ligne.quantite}   onChange={(v) => updateLigne(ligne._id, 'quantite',   v)} min="0" step="0.01" className="w-full text-right" />
                      <Input type="number" value={ligne.prix_ht}    onChange={(v) => updateLigne(ligne._id, 'prix_ht',    v)} min="0" step="0.01" className="w-full text-right" />
                      <Input type="number" value={ligne.tva_pct}    onChange={(v) => updateLigne(ligne._id, 'tva_pct',    v)} min="0" step="0.1"  className="w-full text-right" />
                      <Input type="number" value={ligne.remise_pct} onChange={(v) => updateLigne(ligne._id, 'remise_pct', v)} min="0" max="100" step="0.1" className="w-full text-right" />
                      <button
                        type="button"
                        onClick={() => removeLigne(ligne._id)}
                        disabled={lignes.length === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors disabled:opacity-30"
                        title="Supprimer la ligne"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Sous-total desktop */}
                    <p className="mt-1.5 hidden text-right text-xs text-slate-400 sm:block">
                      Sous-total HT : <strong className="text-slate-800">{fmtEur(ht)}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totaux */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Total HT</span>
                <span className="font-semibold text-slate-700">{fmtEur(totaux.ht)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>TVA</span>
                <span className="font-semibold text-slate-700">{fmtEur(totaux.tva)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800">
                <span>Total TTC</span>
                <span className="text-blue-600">{fmtEur(totaux.ttc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white shadow-sm p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => save('brouillon')}
            disabled={saving}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white transition-colors disabled:opacity-60"
          >
            {saving ? '…' : 'Brouillon'}
          </button>
          <button
            type="button"
            onClick={() => save('envoye')}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
