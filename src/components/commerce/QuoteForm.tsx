'use client';

import { useState, useEffect, useCallback } from 'react';
import { SlideOver }          from '@/components/ui/SlideOver';
import { CatalogueSelector }  from './CatalogueSelector';
import {
  saveQuoteAction,
  deleteQuoteAction,
  changeQuoteStatutAction,
  type Quote,
  type QuoteInput,
  type QuoteLigne,
  type QuoteStatut,
} from '@/app/actions/quotes';
import { fmtEur, fmtDate, todayISO, addDays } from '@/lib/format';
import type { CatalogueItem } from '@/app/actions/catalogue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function calcLigneHT(l: QuoteLigne): number {
  return +(l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100)).toFixed(2);
}

function emptyLigne(): QuoteLigne {
  return {
    id: uid(), reference: '', designation: '', description: '',
    quantite: 1, unite: 'u', prix_unitaire: 0, tva: 20, remise_pct: 0, total_ht: 0,
  };
}

const TVA_OPTIONS = [0, 5.5, 10, 20];

const STATUT_META: Record<QuoteStatut, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600'  },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100 text-blue-700'    },
  accepte:   { label: 'Accepté',  cls: 'bg-green-100 text-green-700'  },
  refuse:    { label: 'Refusé',   cls: 'bg-red-100 text-red-600'      },
};

const STATUT_TRANSITIONS: Partial<Record<QuoteStatut, QuoteStatut[]>> = {
  brouillon: ['envoye'],
  envoye:    ['accepte', 'refuse'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteWithClient extends Quote {
  client_nom: string;
}

interface QuoteFormProps {
  open:      boolean;
  onClose:   () => void;
  editing:   QuoteWithClient | null;
  clients:   { id: string; nom: string }[];
  catalogue: CatalogueItem[];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';
const sectionCls = 'border-b border-slate-100 px-5 py-4 space-y-3';

// ─── Composant totaux ─────────────────────────────────────────────────────────

interface TvaGroup { rate: number; base: number; amount: number; }

function computeTotals(lignes: QuoteLigne[]) {
  const groups = new Map<number, TvaGroup>();
  let totalHT = 0;

  for (const l of lignes) {
    const ht = calcLigneHT(l);
    totalHT += ht;
    if (!groups.has(l.tva)) groups.set(l.tva, { rate: l.tva, base: 0, amount: 0 });
    const g = groups.get(l.tva)!;
    g.base += ht;
    g.amount += +(ht * l.tva / 100).toFixed(2);
  }

  const tvaAmount = [...groups.values()].reduce((s, g) => s + g.amount, 0);
  const totalTTC  = +(totalHT + tvaAmount).toFixed(2);

  return {
    totalHT:   +totalHT.toFixed(2),
    tvaAmount: +tvaAmount.toFixed(2),
    totalTTC,
    tvaGroups: [...groups.values()].sort((a, b) => a.rate - b.rate),
  };
}

// ─── Composant lignes ─────────────────────────────────────────────────────────

function LigneRow({
  ligne, onChange, onDelete, readonly,
}: {
  ligne:    QuoteLigne;
  onChange: (l: QuoteLigne) => void;
  onDelete: () => void;
  readonly: boolean;
}) {
  function update(patch: Partial<QuoteLigne>) {
    const next = { ...ligne, ...patch };
    next.total_ht = calcLigneHT(next);
    onChange(next);
  }

  const cellCls = 'px-1.5 py-1 align-top';
  const numCls  = `${inputCls} text-right px-2 py-1.5 text-xs`;
  const txtCls  = `${inputCls} px-2 py-1.5 text-xs`;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      {/* Réf */}
      <td className={cellCls} style={{ width: '80px' }}>
        <input
          type="text" value={ligne.reference} disabled={readonly}
          onChange={(e) => update({ reference: e.target.value })}
          className={txtCls} placeholder="Réf"
        />
      </td>
      {/* Désignation + description */}
      <td className={cellCls}>
        <input
          type="text" value={ligne.designation} disabled={readonly}
          onChange={(e) => update({ designation: e.target.value })}
          className={txtCls} placeholder="Désignation *"
        />
        <input
          type="text" value={ligne.description} disabled={readonly}
          onChange={(e) => update({ description: e.target.value })}
          className={`${txtCls} mt-1 text-slate-400`} placeholder="Description (optionnel)"
        />
      </td>
      {/* Qté */}
      <td className={cellCls} style={{ width: '70px' }}>
        <input
          type="number" value={ligne.quantite} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ quantite: +e.target.value || 0 })}
          className={numCls}
        />
      </td>
      {/* Unité */}
      <td className={cellCls} style={{ width: '60px' }}>
        <input
          type="text" value={ligne.unite} disabled={readonly}
          onChange={(e) => update({ unite: e.target.value })}
          className={txtCls} placeholder="u"
        />
      </td>
      {/* Prix HT */}
      <td className={cellCls} style={{ width: '90px' }}>
        <input
          type="number" value={ligne.prix_unitaire} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ prix_unitaire: +e.target.value || 0 })}
          className={numCls} placeholder="0,00"
        />
      </td>
      {/* TVA */}
      <td className={cellCls} style={{ width: '70px' }}>
        <select
          value={ligne.tva} disabled={readonly}
          onChange={(e) => update({ tva: +e.target.value })}
          className={`${txtCls} pr-1`}
        >
          {TVA_OPTIONS.map((t) => <option key={t} value={t}>{t} %</option>)}
        </select>
      </td>
      {/* Remise */}
      <td className={cellCls} style={{ width: '65px' }}>
        <input
          type="number" value={ligne.remise_pct} min={0} max={100} step="any" disabled={readonly}
          onChange={(e) => update({ remise_pct: +e.target.value || 0 })}
          className={numCls} placeholder="0"
        />
      </td>
      {/* Total HT */}
      <td className={cellCls} style={{ width: '90px' }}>
        <div className="py-1.5 px-2 text-right text-xs font-semibold text-slate-700">
          {fmtEur(ligne.total_ht)}
        </div>
      </td>
      {/* Supprimer */}
      <td className={`${cellCls} w-8`}>
        {!readonly && (
          <button
            type="button" onClick={onDelete}
            className="rounded p-1 text-slate-300 hover:text-red-500 transition-colors"
            title="Supprimer cette ligne"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const VALIDITY_DAYS = [15, 30, 45, 60, 90];

const DEFAULT_CONDITIONS = `Conditions de paiement : 30 jours net à réception de facture.
Devis valable sous réserve d'acceptation dans les délais indiqués.`;

export function QuoteForm({ open, onClose, editing, clients, catalogue }: QuoteFormProps) {
  // ── Champs formulaire ──
  const [clientId,    setClientId]    = useState<string>('');
  const [objet,       setObjet]       = useState('');
  const [date,        setDate]        = useState(todayISO());
  const [validity,    setValidity]    = useState(addDays(todayISO(), 30));
  const [lignes,      setLignes]      = useState<QuoteLigne[]>([emptyLigne()]);
  const [notes,       setNotes]       = useState('');
  const [conditions,  setConditions]  = useState(DEFAULT_CONDITIONS);

  // ── UI state ──
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [error,       setError]       = useState('');
  const [statusBusy,  setStatusBusy]  = useState(false);

  const readonly = editing ? editing.statut !== 'brouillon' : false;
  const statut   = editing?.statut ?? 'brouillon';

  // Sync state when editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setClientId(editing.client_id ?? '');
      setObjet(editing.objet ?? '');
      setDate(editing.date);
      setValidity(editing.validity ?? addDays(editing.date, 30));
      setLignes(editing.lignes.length > 0 ? editing.lignes : [emptyLigne()]);
      setNotes(editing.notes ?? '');
      setConditions(editing.conditions ?? DEFAULT_CONDITIONS);
    } else {
      const today = todayISO();
      setClientId('');
      setObjet('');
      setDate(today);
      setValidity(addDays(today, 30));
      setLignes([emptyLigne()]);
      setNotes('');
      setConditions(DEFAULT_CONDITIONS);
    }
    setError('');
    setConfirmDel(false);
  }, [open, editing]);

  // ── Lignes helpers ──
  const updateLigne = useCallback((idx: number, l: QuoteLigne) => {
    setLignes((prev) => prev.map((p, i) => i === idx ? l : p));
  }, []);

  const deleteLigne = useCallback((idx: number) => {
    setLignes((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  function addEmptyLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function addFromCatalogue(item: import('./CatalogueSelector').CatalogueSelectorResult) {
    const ligne: QuoteLigne = {
      id:            uid(),
      reference:     item.reference,
      designation:   item.designation,
      description:   '',
      quantite:      1,
      unite:         item.unite,
      prix_unitaire: item.prix_vente,
      tva:           item.tva,
      remise_pct:    0,
      total_ht:      item.prix_vente,
    };
    setLignes((prev) => {
      // Replace last empty line if it's blank
      const last = prev[prev.length - 1];
      if (last && !last.designation && !last.reference && last.prix_unitaire === 0) {
        return [...prev.slice(0, -1), ligne];
      }
      return [...prev, ligne];
    });
  }

  // ── Totaux ──
  const totals = computeTotals(lignes);

  // ── Validité rapide ──
  function setValidityFromDays(days: number) {
    setValidity(addDays(date, days));
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    const validLines = lignes.filter((l) => l.designation.trim());
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne.'); return; }

    const input: QuoteInput = {
      client_id:   clientId || null,
      objet,
      date,
      validity,
      lignes:      validLines.map((l) => ({ ...l, total_ht: calcLigneHT(l) })),
      notes,
      conditions,
      montant_ht:  totals.totalHT,
      tva_amount:  totals.tvaAmount,
      montant_ttc: totals.totalTTC,
    };

    setSaving(true);
    setError('');
    const res = await saveQuoteAction(input, editing?.id);
    setSaving(false);

    if (res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Delete ──
  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    const res = await deleteQuoteAction(editing.id);
    setDeleting(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Changement de statut ──
  async function handleStatusChange(s: QuoteStatut) {
    if (!editing) return;
    setStatusBusy(true);
    const res = await changeQuoteStatutAction(editing.id, s);
    setStatusBusy(false);
    if (res.error) setError(res.error);
  }

  const title = editing
    ? `Devis ${editing.number}`
    : 'Nouveau devis';

  const transitions = editing ? (STATUT_TRANSITIONS[statut] ?? []) : [];

  return (
    <SlideOver open={open} onClose={onClose} title={title} width="xl">
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">

          {/* Statut + transitions */}
          {editing && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUT_META[statut].cls}`}>
                {STATUT_META[statut].label}
              </span>
              {transitions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={statusBusy || readonly === false && saving}
                  onClick={() => handleStatusChange(s)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  → {STATUT_META[s].label}
                </button>
              ))}
              {readonly && (
                <span className="ml-auto text-xs text-slate-400 italic">Lecture seule</span>
              )}
            </div>
          )}

          {/* Bannière accepté → créer projet */}
          {statut === 'accepte' && (
            <div className="mx-5 mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 shrink-0 text-green-600" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">Devis accepté</p>
                <p className="text-xs text-green-600">La création de projet sera disponible dans R4.</p>
              </div>
              <button
                type="button"
                disabled
                className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white opacity-40 cursor-not-allowed"
              >
                Créer le projet
              </button>
            </div>
          )}

          {/* ── Section Informations ── */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informations</h3>

            {/* N° devis (readonly si édition) */}
            {editing && (
              <div>
                <label className={labelCls}>N° Devis</label>
                <input
                  type="text" value={editing.number} disabled
                  className={inputCls}
                />
              </div>
            )}

            {/* Client */}
            <div>
              <label className={labelCls}>Client *</label>
              <select
                value={clientId} disabled={readonly}
                onChange={(e) => setClientId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>

            {/* Objet */}
            <div>
              <label className={labelCls}>Objet</label>
              <input
                type="text" value={objet} disabled={readonly}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Objet du devis"
                className={inputCls}
              />
            </div>

            {/* Date + Validité */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date" value={date} disabled={readonly}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Validité</label>
                <input
                  type="date" value={validity} disabled={readonly}
                  onChange={(e) => setValidity(e.target.value)}
                  className={inputCls}
                />
                {!readonly && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {VALIDITY_DAYS.map((d) => (
                      <button
                        key={d} type="button"
                        onClick={() => setValidityFromDays(d)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        {d}j
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section Lignes ── */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Lignes ({lignes.filter((l) => l.designation).length})
              </h3>
              {!readonly && (
                <button
                  type="button" onClick={addEmptyLigne}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ligne vide
                </button>
              )}
            </div>

            {/* Catalogue selector */}
            {!readonly && (
              <CatalogueSelector
                catalogue={catalogue}
                onSelect={addFromCatalogue}
                placeholder="Ajouter depuis le catalogue…"
                className="mb-3"
              />
            )}

            {/* Table lignes */}
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400">
                    <th className="px-1.5 py-2 text-left">Réf</th>
                    <th className="px-1.5 py-2 text-left">Désignation</th>
                    <th className="px-1.5 py-2 text-right">Qté</th>
                    <th className="px-1.5 py-2 text-left">Unité</th>
                    <th className="px-1.5 py-2 text-right">Prix HT</th>
                    <th className="px-1.5 py-2 text-right">TVA</th>
                    <th className="px-1.5 py-2 text-right">Remise</th>
                    <th className="px-1.5 py-2 text-right">Total HT</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, idx) => (
                    <LigneRow
                      key={l.id}
                      ligne={l}
                      onChange={(updated) => updateLigne(idx, updated)}
                      onDelete={() => deleteLigne(idx)}
                      readonly={readonly}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section Totaux ── */}
          <div className={`${sectionCls}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Totaux</h3>
            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total HT</span>
                <span className="font-medium">{fmtEur(totals.totalHT)}</span>
              </div>
              {totals.tvaGroups.map((g) => (
                g.amount > 0 ? (
                  <div key={g.rate} className="flex justify-between text-slate-500 text-xs">
                    <span>TVA {g.rate} % (base {fmtEur(g.base)})</span>
                    <span>{fmtEur(g.amount)}</span>
                  </div>
                ) : null
              ))}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                <span>Total TTC</span>
                <span className="text-base">{fmtEur(totals.totalTTC)}</span>
              </div>
              {totals.tvaAmount === 0 && (
                <p className="text-xs text-slate-400 text-right">TVA non applicable</p>
              )}
            </div>
          </div>

          {/* ── Section Conditions ── */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes &amp; Conditions</h3>
            <div>
              <label className={labelCls}>Notes internes</label>
              <textarea
                value={notes} disabled={readonly}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes visibles uniquement en interne…"
                className={`${inputCls} resize-y`}
              />
            </div>
            <div>
              <label className={labelCls}>Conditions</label>
              <textarea
                value={conditions} disabled={readonly}
                onChange={(e) => setConditions(e.target.value)}
                rows={3}
                placeholder="Conditions de paiement, délais, mentions légales…"
                className={`${inputCls} resize-y`}
              />
            </div>
          </div>

        </div>{/* end scrollable */}

        {/* Erreur */}
        {error && (
          <div className="shrink-0 px-5 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-slate-200 px-5 py-3 flex items-center gap-2">
          {/* Supprimer */}
          {editing && !confirmDel && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="mr-auto rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Supprimer
            </button>
          )}
          {editing && confirmDel && (
            <div className="mr-auto flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
              <button
                type="button" disabled={deleting}
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              <button
                type="button" onClick={() => setConfirmDel(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {readonly ? 'Fermer' : 'Annuler'}
            </button>
            {!readonly && (
              <button
                type="submit" disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le devis'}
              </button>
            )}
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
