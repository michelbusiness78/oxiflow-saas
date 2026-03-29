'use client';

import { useState, useCallback, useMemo } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO, addDays } from '@/lib/format';
import {
  createDevisAction,
  updateDevisAction,
  type DevisInput,
  type DevisLigne,
} from '@/app/actions/commerce';

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
  open:     boolean;
  onClose:  () => void;
  clients:  Client[];
  editing?: Devis | null;
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

// ─── Champ texte simple ───────────────────────────────────────────────────────

function Input({
  value, onChange, type = 'text', placeholder = '', className = '', min, max, step, required,
}: {
  value: string | number; onChange: (v: string) => void; type?: string;
  placeholder?: string; className?: string; min?: string; max?: string; step?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={type === 'number' ? (e) => e.target.select() : undefined}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      required={required}
      className={[
        'rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text',
        'outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary',
        'placeholder:text-oxi-text-muted',
        className,
      ].join(' ')}
    />
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function DevisForm({ open, onClose, clients, editing }: DevisFormProps) {
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
              <label className="block text-sm font-medium text-oxi-text">
                Client <span className="text-oxi-danger">*</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2.5 text-sm text-oxi-text outline-none focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Date</label>
              <Input type="date" value={date} onChange={setDate} className="w-full" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-oxi-text">Validité</label>
              <Input type="date" value={validite} onChange={setValidite} className="w-full" />
            </div>
          </div>

          {/* Lignes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-oxi-text">Lignes</h3>
              <button
                type="button"
                onClick={addLigne}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-oxi-primary hover:bg-oxi-primary-light transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>
            </div>

            {/* En-têtes colonnes */}
            <div className="hidden grid-cols-[1fr_80px_90px_60px_60px_36px] gap-2 mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-oxi-text-muted sm:grid">
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
                  <div key={ligne._id} className="rounded-lg border border-oxi-border bg-oxi-bg p-3">
                    {/* Mobile : empilé */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <Input
                        value={ligne.designation}
                        onChange={(v) => updateLigne(ligne._id, 'designation', v)}
                        placeholder={`Désignation ligne ${i + 1}`}
                        className="w-full"
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="number" value={ligne.quantite}   onChange={(v) => updateLigne(ligne._id, 'quantite',   v)} placeholder="Qté"  min="0" step="0.01" className="w-full" />
                        <Input type="number" value={ligne.prix_ht}    onChange={(v) => updateLigne(ligne._id, 'prix_ht',    v)} placeholder="PU HT" min="0" step="0.01" className="w-full" />
                        <Input type="number" value={ligne.tva_pct}    onChange={(v) => updateLigne(ligne._id, 'tva_pct',    v)} placeholder="TVA %" min="0" step="0.1"  className="w-full" />
                        <Input type="number" value={ligne.remise_pct} onChange={(v) => updateLigne(ligne._id, 'remise_pct', v)} placeholder="Rem %" min="0" max="100" step="0.1" className="w-full" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-oxi-text-muted">Sous-total HT : <strong>{fmtEur(ht)}</strong></span>
                        <button type="button" onClick={() => removeLigne(ligne._id)} className="text-oxi-danger hover:underline text-xs">Supprimer</button>
                      </div>
                    </div>

                    {/* Desktop : grille */}
                    <div className="hidden items-center gap-2 sm:grid sm:grid-cols-[1fr_80px_90px_60px_60px_36px]">
                      <Input value={ligne.designation}  onChange={(v) => updateLigne(ligne._id, 'designation',  v)} placeholder={`Ligne ${i + 1}`} className="w-full" required />
                      <Input type="number" value={ligne.quantite}   onChange={(v) => updateLigne(ligne._id, 'quantite',   v)} min="0" step="0.01" className="w-full text-right" />
                      <Input type="number" value={ligne.prix_ht}    onChange={(v) => updateLigne(ligne._id, 'prix_ht',    v)} min="0" step="0.01" className="w-full text-right" />
                      <Input type="number" value={ligne.tva_pct}    onChange={(v) => updateLigne(ligne._id, 'tva_pct',    v)} min="0" step="0.1"  className="w-full text-right" />
                      <Input type="number" value={ligne.remise_pct} onChange={(v) => updateLigne(ligne._id, 'remise_pct', v)} min="0" max="100" step="0.1" className="w-full text-right" />
                      <button
                        type="button"
                        onClick={() => removeLigne(ligne._id)}
                        disabled={lignes.length === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-oxi-text-muted hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors disabled:opacity-30"
                        title="Supprimer la ligne"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Sous-total desktop */}
                    <p className="mt-1.5 hidden text-right text-xs text-oxi-text-muted sm:block">
                      Sous-total HT : <strong className="text-oxi-text">{fmtEur(ht)}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totaux */}
          <div className="rounded-xl border border-oxi-border bg-oxi-bg p-4">
            <div className="space-y-1.5 text-sm">
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
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-oxi-border bg-oxi-surface p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => save('brouillon')}
            disabled={saving}
            className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text hover:bg-oxi-bg transition-colors disabled:opacity-60"
          >
            {saving ? '…' : 'Brouillon'}
          </button>
          <button
            type="button"
            onClick={() => save('envoye')}
            disabled={saving}
            className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
