'use client';

import { useState, useCallback, useMemo } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO, addDays } from '@/lib/format';
import {
  createFactureAction,
  updateFactureAction,
  type FactureInput,
} from '@/app/actions/factures';
import type { DevisLigne } from '@/app/actions/commerce';

interface Client { id: string; nom: string; }

export interface Facture {
  id:          string;
  num:         string;
  client_id:   string;
  devis_id?:   string | null;
  date:        string;
  echeance:    string;
  statut:      string;
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
}

interface FactureFormProps {
  open:       boolean;
  onClose:    () => void;
  clients:    Client[];
  editing?:   Facture | null;
  fromDevis?: { client_id: string; lignes: DevisLigne[]; montant_ht: number; tva: number; montant_ttc: number; id: string } | null;
}

type LigneLocal = DevisLigne & { _id: string };

function newLigne(): LigneLocal {
  return { _id: crypto.randomUUID(), designation: '', quantite: 1, prix_ht: 0, tva_pct: 20, remise_pct: 0 };
}

function calcLigne(l: LigneLocal) {
  const ht  = l.quantite * l.prix_ht * (1 - l.remise_pct / 100);
  return { ht, tva: ht * l.tva_pct / 100, ttc: ht + ht * l.tva_pct / 100 };
}

function calcTotaux(lignes: LigneLocal[]) {
  const rows = lignes.map(calcLigne);
  const ht   = rows.reduce((s, r) => s + r.ht,  0);
  const tva  = rows.reduce((s, r) => s + r.tva, 0);
  return { ht, tva, ttc: ht + tva };
}

function NumInput({ value, onChange, min, max, step, className = '' }: {
  value: number; onChange: (v: string) => void; min?: string; max?: string; step?: string; className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      step={step ?? '0.01'}
      className={['rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary', className].join(' ')}
    />
  );
}

export function FactureForm({ open, onClose, clients, editing, fromDevis }: FactureFormProps) {
  const today = todayISO();

  const initLignes = useCallback((): LigneLocal[] => {
    const src = editing?.lignes ?? fromDevis?.lignes;
    if (src?.length) return src.map((l) => ({ ...l, _id: crypto.randomUUID() }));
    return [newLigne()];
  }, [editing, fromDevis]);

  const [clientId, setClientId] = useState(editing?.client_id ?? fromDevis?.client_id ?? '');
  const [devisRef, setDevisRef] = useState(editing?.devis_id  ?? fromDevis?.id         ?? '');
  const [date,     setDate]     = useState(editing?.date      ?? today);
  const [echeance, setEcheance] = useState(editing?.echeance  ?? addDays(today, 30));
  const [lignes,   setLignes]   = useState<LigneLocal[]>(initLignes);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const totaux = useMemo(() => calcTotaux(lignes), [lignes]);

  function updateLigne(id: string, key: keyof LigneLocal, raw: string) {
    setLignes((prev) => prev.map((l) => {
      if (l._id !== id) return l;
      const num = ['quantite', 'prix_ht', 'tva_pct', 'remise_pct'].includes(key) ? parseFloat(raw) || 0 : raw;
      return { ...l, [key]: num };
    }));
  }

  async function save(statut: 'brouillon' | 'envoyee') {
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    if (lignes.some((l) => !l.designation.trim())) { setError('Chaque ligne doit avoir une désignation.'); return; }
    setSaving(true);
    setError('');

    const input: FactureInput = {
      client_id:   clientId,
      devis_id:    devisRef || null,
      date,
      echeance,
      statut,
      lignes:      lignes.map(({ _id: _, ...rest }) => rest),
      montant_ht:  parseFloat(totaux.ht.toFixed(2)),
      tva:         parseFloat(totaux.tva.toFixed(2)),
      montant_ttc: parseFloat(totaux.ttc.toFixed(2)),
    };

    const res = editing
      ? await updateFactureAction(editing.id, input)
      : await createFactureAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? `Modifier ${editing.num}` : 'Nouvelle facture'} width="xl">
      <div className="flex flex-col">
        <div className="space-y-5 p-5">
          {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

          {/* Bandeau "depuis devis" */}
          {fromDevis && !editing && (
            <div className="rounded-lg border border-oxi-primary/20 bg-oxi-primary-light px-4 py-3 text-sm text-oxi-primary">
              Facture pré-remplie depuis le devis associé.
            </div>
          )}

          {/* Client + Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-oxi-text">Client <span className="text-oxi-danger">*</span></label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2.5 text-sm text-oxi-text outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2.5 text-sm text-oxi-text outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Échéance</label>
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2.5 text-sm text-oxi-text outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary" />
            </div>
          </div>

          {/* Lignes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-oxi-text">Lignes</h3>
              <button
                type="button"
                onClick={() => setLignes((p) => [...p, newLigne()])}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-oxi-primary hover:bg-oxi-primary-light transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>
            </div>
            <div className="space-y-2">
              {lignes.map((ligne, i) => {
                const { ht } = calcLigne(ligne);
                return (
                  <div key={ligne._id} className="rounded-lg border border-oxi-border bg-oxi-bg p-3 space-y-2">
                    <input
                      type="text"
                      value={ligne.designation}
                      onChange={(e) => updateLigne(ligne._id, 'designation', e.target.value)}
                      placeholder={`Désignation ligne ${i + 1}`}
                      className="w-full rounded-lg border border-oxi-border bg-oxi-surface px-3 py-2 text-sm text-oxi-text outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-xs text-oxi-text-muted">Qté</span>
                        <NumInput value={ligne.quantite}   onChange={(v) => updateLigne(ligne._id, 'quantite',   v)} min="0" className="w-full mt-1" />
                      </div>
                      <div>
                        <span className="text-xs text-oxi-text-muted">PU HT €</span>
                        <NumInput value={ligne.prix_ht}    onChange={(v) => updateLigne(ligne._id, 'prix_ht',    v)} min="0" className="w-full mt-1" />
                      </div>
                      <div>
                        <span className="text-xs text-oxi-text-muted">TVA %</span>
                        <NumInput value={ligne.tva_pct}    onChange={(v) => updateLigne(ligne._id, 'tva_pct',    v)} min="0" step="0.1" className="w-full mt-1" />
                      </div>
                      <div>
                        <span className="text-xs text-oxi-text-muted">Remise %</span>
                        <NumInput value={ligne.remise_pct} onChange={(v) => updateLigne(ligne._id, 'remise_pct', v)} min="0" max="100" step="0.1" className="w-full mt-1" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-oxi-text-muted">Sous-total HT : <strong className="text-oxi-text">{fmtEur(ht)}</strong></span>
                      <button
                        type="button"
                        onClick={() => lignes.length > 1 && setLignes((p) => p.filter((l) => l._id !== ligne._id))}
                        disabled={lignes.length === 1}
                        className="text-xs text-oxi-danger hover:underline disabled:opacity-30"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totaux */}
          <div className="rounded-xl border border-oxi-border bg-oxi-bg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-oxi-text-secondary">
              <span>Total HT</span>
              <span className="font-medium text-oxi-text">{fmtEur(totaux.ht)}</span>
            </div>
            <div className="flex justify-between text-oxi-text-secondary">
              <span>TVA</span>
              <span className="font-medium text-oxi-text">{fmtEur(totaux.tva)}</span>
            </div>
            <div className="flex justify-between border-t border-oxi-border pt-2 text-base font-bold text-oxi-text">
              <span>Total TTC</span>
              <span className="text-oxi-primary">{fmtEur(totaux.ttc)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-oxi-border bg-oxi-surface p-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => save('brouillon')} disabled={saving} className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text hover:bg-oxi-bg transition-colors disabled:opacity-60">
            Brouillon
          </button>
          <button type="button" onClick={() => save('envoyee')} disabled={saving} className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
