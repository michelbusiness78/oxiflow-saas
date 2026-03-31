'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SlideOver }         from '@/components/ui/SlideOver';
import { CatalogueSelector } from './CatalogueSelector';
import {
  saveQuoteAction,
  deleteQuoteAction,
  changeQuoteStatutAction,
  type Quote,
  type QuoteInput,
  type QuoteLigne,
  type QuoteStatut,
} from '@/app/actions/quotes';
import { createProjectFromQuote } from '@/app/actions/projects';
import { fmtEur, fmtDate, todayISO, addDays } from '@/lib/format';
import type { CatalogueItem, CatalogueType } from '@/app/actions/catalogue';

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
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600'   },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100 text-blue-700'     },
  accepte:   { label: 'Accepté',  cls: 'bg-green-100 text-green-700'   },
  refuse:    { label: 'Refusé',   cls: 'bg-red-100 text-red-600'       },
};

// Transitions vers l'avant (progression)
const FORWARD_TRANSITIONS: Partial<Record<QuoteStatut, QuoteStatut[]>> = {
  brouillon: ['envoye'],
  envoye:    ['accepte', 'refuse'],
};

// Transitions vers l'arrière (correction)
const BACK_TRANSITIONS: Partial<Record<QuoteStatut, QuoteStatut[]>> = {
  envoye: ['brouillon'],
};

// Couleurs des types catalogue pour les mini-cartes
const TYPE_CARD_CLS: Record<CatalogueType, { badge: string; dot: string }> = {
  materiel:    { badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'   },
  service:     { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  forfait:     { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500'  },
  main_oeuvre: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  fourniture:  { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400'  },
};

const TYPE_LABEL_SHORT: Record<CatalogueType, string> = {
  materiel:    'Mat.',
  service:     'Svc',
  forfait:     'Forf.',
  main_oeuvre: 'MO',
  fourniture:  'Four.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteWithClient extends Quote {
  client_nom: string;
}

export interface TenantUser {
  id:   string;
  name: string;
}

interface QuoteFormProps {
  open:            boolean;
  onClose:         () => void;
  editing:         QuoteWithClient | null;
  clients:         { id: string; nom: string }[];
  catalogue:       CatalogueItem[];
  users:           TenantUser[];
  currentUserId:   string;
  currentUserName: string;
  tenantName:      string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls  = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';
const roInputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-500 cursor-not-allowed select-none';
const labelCls  = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';
const sectionCls = 'border-b border-slate-100 px-5 py-4 space-y-3';

// ─── Totaux ───────────────────────────────────────────────────────────────────

interface TvaGroup { rate: number; base: number; amount: number; }

function computeTotals(lignes: QuoteLigne[]) {
  const groups = new Map<number, TvaGroup>();
  let totalHT = 0;

  for (const l of lignes) {
    const ht = calcLigneHT(l);
    totalHT += ht;
    if (!groups.has(l.tva)) groups.set(l.tva, { rate: l.tva, base: 0, amount: 0 });
    const g = groups.get(l.tva)!;
    g.base   += ht;
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

// ─── LigneRow ─────────────────────────────────────────────────────────────────

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
      <td className={cellCls} style={{ width: '80px' }}>
        <input type="text" value={ligne.reference} disabled={readonly}
          onChange={(e) => update({ reference: e.target.value })}
          className={txtCls} placeholder="Réf" />
      </td>
      <td className={cellCls}>
        <input type="text" value={ligne.designation} disabled={readonly}
          onChange={(e) => update({ designation: e.target.value })}
          className={txtCls} placeholder="Désignation *" />
        <input type="text" value={ligne.description} disabled={readonly}
          onChange={(e) => update({ description: e.target.value })}
          className={`${txtCls} mt-1 text-slate-400`} placeholder="Description (optionnel)" />
      </td>
      <td className={cellCls} style={{ width: '70px' }}>
        <input type="number" value={ligne.quantite} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ quantite: +e.target.value || 0 })}
          className={numCls} />
      </td>
      <td className={cellCls} style={{ width: '60px' }}>
        <input type="text" value={ligne.unite} disabled={readonly}
          onChange={(e) => update({ unite: e.target.value })}
          className={txtCls} placeholder="u" />
      </td>
      <td className={cellCls} style={{ width: '90px' }}>
        <input type="number" value={ligne.prix_unitaire} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ prix_unitaire: +e.target.value || 0 })}
          className={numCls} placeholder="0,00" />
      </td>
      <td className={cellCls} style={{ width: '70px' }}>
        <select value={ligne.tva} disabled={readonly}
          onChange={(e) => update({ tva: +e.target.value })}
          className={`${txtCls} pr-1`}>
          {TVA_OPTIONS.map((t) => <option key={t} value={t}>{t} %</option>)}
        </select>
      </td>
      <td className={cellCls} style={{ width: '65px' }}>
        <input type="number" value={ligne.remise_pct} min={0} max={100} step="any" disabled={readonly}
          onChange={(e) => update({ remise_pct: +e.target.value || 0 })}
          className={numCls} placeholder="0" />
      </td>
      <td className={cellCls} style={{ width: '90px' }}>
        <div className="py-1.5 px-2 text-right text-xs font-semibold text-slate-700">
          {fmtEur(ligne.total_ht)}
        </div>
      </td>
      <td className={`${cellCls} w-8`}>
        {!readonly && (
          <button type="button" onClick={onDelete}
            className="rounded p-1 text-slate-300 hover:text-red-500 transition-colors" title="Supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Mini-cartes catalogue ────────────────────────────────────────────────────

function CatalogueMiniCards({
  catalogue,
  onAdd,
}: {
  catalogue: CatalogueItem[];
  onAdd: (item: CatalogueItem) => void;
}) {
  const cards = useMemo(
    () => catalogue.filter((c) => c.actif).slice(0, 6),
    [catalogue],
  );

  if (cards.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        Ajout rapide depuis le catalogue :
      </p>
      <div className="flex flex-wrap gap-2">
        {cards.map((item) => {
          const cls = TYPE_CARD_CLS[item.type] ?? TYPE_CARD_CLS.fourniture;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onAdd(item)}
              className="group flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-blue-300 hover:shadow-sm transition-all"
              style={{ minWidth: '130px', maxWidth: '180px' }}
            >
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls.badge}`}>
                {TYPE_LABEL_SHORT[item.type]}
              </span>
              <span className="text-xs font-medium text-slate-700 leading-tight">
                {item.designation.length > 30
                  ? item.designation.slice(0, 30) + '…'
                  : item.designation}
              </span>
              <span className="text-xs text-slate-400">
                {item.prix_vente.toFixed(2)} € / {item.unite}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const VALIDITY_DAYS = [15, 30, 45, 60, 90];

const DEFAULT_CONDITIONS =
  `Conditions de paiement : 30 jours net à réception de facture.\n` +
  `Devis valable sous réserve d'acceptation dans les délais indiqués.`;

export function QuoteForm({
  open, onClose, editing, clients, catalogue,
  users, currentUserId, currentUserName, tenantName,
}: QuoteFormProps) {
  // ── Champs ──
  const [clientId,       setClientId]       = useState('');
  const [chefProjetId,   setChefProjetId]   = useState('');
  const [objet,          setObjet]          = useState('');
  const [date,           setDate]           = useState(todayISO());
  const [validity,       setValidity]       = useState(addDays(todayISO(), 30));
  const [lignes,         setLignes]         = useState<QuoteLigne[]>([emptyLigne()]);
  const [notes,          setNotes]          = useState('');
  const [conditions,     setConditions]     = useState(DEFAULT_CONDITIONS);
  const [depositPercent, setDepositPercent] = useState(0);

  // ── UI ──
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [confirmDel,      setConfirmDel]      = useState(false);
  const [error,           setError]           = useState('');
  const [statusBusy,      setStatusBusy]      = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectCreated,  setProjectCreated]  = useState(false);
  const [projectToast,    setProjectToast]    = useState('');

  const statut   = editing?.statut ?? 'brouillon';
  const readonly = editing ? editing.statut !== 'brouillon' : false;

  // Résoudre le nom du commercial depuis la liste users
  const commercialName = useMemo(() => {
    if (!editing?.commercial_user_id) return currentUserName;
    return users.find((u) => u.id === editing.commercial_user_id)?.name ?? currentUserName;
  }, [editing, users, currentUserName]);

  // Sync state
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setClientId(editing.client_id ?? '');
      setChefProjetId(editing.chef_projet_user_id ?? '');
      setObjet(editing.objet ?? '');
      setDate(editing.date);
      setValidity(editing.validity ?? addDays(editing.date, 30));
      setLignes(editing.lignes.length > 0 ? editing.lignes : [emptyLigne()]);
      setNotes(editing.notes ?? '');
      setConditions(editing.conditions ?? DEFAULT_CONDITIONS);
      setDepositPercent(editing.deposit_percent ?? 0);
    } else {
      const today = todayISO();
      setClientId('');
      setChefProjetId('');
      setObjet('');
      setDate(today);
      setValidity(addDays(today, 30));
      setLignes([emptyLigne()]);
      setNotes('');
      setConditions(DEFAULT_CONDITIONS);
      setDepositPercent(0);
    }
    setProjectCreated(editing?.project_created ?? false);
    setProjectToast('');
    setError('');
    setConfirmDel(false);
  }, [open, editing]);

  // ── Lignes ──
  const updateLigne = useCallback((idx: number, l: QuoteLigne) => {
    setLignes((prev) => prev.map((p, i) => i === idx ? l : p));
  }, []);

  const deleteLigne = useCallback((idx: number) => {
    setLignes((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  function addEmptyLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function addFromItem(item: { reference: string; designation: string; prix_vente: number; tva: number; unite: string }) {
    const ligne: QuoteLigne = {
      id: uid(),
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
      const last = prev[prev.length - 1];
      if (last && !last.designation && !last.reference && last.prix_unitaire === 0) {
        return [...prev.slice(0, -1), ligne];
      }
      return [...prev, ligne];
    });
  }

  function addFromCatalogueItem(item: CatalogueItem) {
    addFromItem({
      reference:   item.ref ?? '',
      designation: item.designation,
      prix_vente:  item.prix_vente,
      tva:         item.tva,
      unite:       item.unite,
    });
  }

  function addFromSelector(item: import('./CatalogueSelector').CatalogueSelectorResult) {
    addFromItem({
      reference:   item.reference,
      designation: item.designation,
      prix_vente:  item.prix_vente,
      tva:         item.tva,
      unite:       item.unite,
    });
  }

  // ── Totaux ──
  const totals = computeTotals(lignes);

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
      client_id:           clientId || null,
      chef_projet_user_id: chefProjetId || null,
      objet,
      date,
      validity,
      lignes:              validLines.map((l) => ({ ...l, total_ht: calcLigneHT(l) })),
      notes,
      conditions,
      deposit_percent:     depositPercent,
      montant_ht:          totals.totalHT,
      tva_amount:          totals.tvaAmount,
      montant_ttc:         totals.totalTTC,
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

  // ── Changement statut ──
  async function handleStatusChange(s: QuoteStatut) {
    if (!editing) return;
    setStatusBusy(true);
    const res = await changeQuoteStatutAction(editing.id, s);
    setStatusBusy(false);
    if (res.error) setError(res.error);
  }

  // ── Créer le projet ──
  async function handleCreateProject() {
    if (!editing) return;
    setCreatingProject(true);
    setProjectToast('');
    const res = await createProjectFromQuote(editing.id);
    setCreatingProject(false);
    if (res.error) {
      setProjectToast(`❌ ${res.error}`);
      setTimeout(() => setProjectToast(''), 5000);
      return;
    }
    setProjectCreated(true);
    setProjectToast('✅ Projet créé avec succès');
    setTimeout(() => setProjectToast(''), 5000);
  }

  const forwardTransitions = editing ? (FORWARD_TRANSITIONS[statut] ?? []) : [];
  const backTransitions     = editing ? (BACK_TRANSITIONS[statut] ?? [])    : [];

  const title = editing ? `Devis ${editing.number}` : 'Nouveau devis';

  return (
    <SlideOver open={open} onClose={onClose} title={title} width="xl">
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">

          {/* ── Barre statut + transitions ── */}
          {editing && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUT_META[statut].cls}`}>
                {STATUT_META[statut].label}
              </span>

              {/* Transitions vers l'avant */}
              {forwardTransitions.map((s) => (
                <button key={s} type="button" disabled={statusBusy}
                  onClick={() => handleStatusChange(s)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                  → {STATUT_META[s].label}
                </button>
              ))}

              {/* Transitions vers l'arrière (retour en brouillon) */}
              {backTransitions.map((s) => (
                <button key={s} type="button" disabled={statusBusy}
                  onClick={() => handleStatusChange(s)}
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:border-amber-400 hover:bg-amber-100 transition-colors disabled:opacity-50">
                  ↩ Repasser en {STATUT_META[s].label.toLowerCase()}
                </button>
              ))}

              {readonly && (
                <span className="ml-auto text-xs italic text-slate-400">Lecture seule</span>
              )}
            </div>
          )}

          {/* ── Blocs devis accepté ── */}
          {statut === 'accepte' && (
            <div className="mx-5 mt-4 space-y-3">

              {/* Toast projet */}
              {projectToast && (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${projectToast.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {projectToast}
                </div>
              )}

              {/* Bloc projet : créé ou à créer */}
              {projectCreated ? (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-[#eff6ff] px-4 py-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 shrink-0 text-blue-500" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800">🔗 Projet créé depuis ce devis</p>
                    <p className="text-xs text-blue-600">Matériel pré-rempli · Visible dans le module Projets.</p>
                  </div>
                  <a href="/projets" className="shrink-0 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                    Voir →
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 shrink-0 text-green-600" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-green-800">Devis accepté</p>
                    <p className="text-xs text-green-600">Créez le projet pour affecter le chef de projet et démarrer le suivi.</p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingProject}
                    onClick={handleCreateProject}
                    className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {creatingProject ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Création…
                      </span>
                    ) : 'Créer le projet'}
                  </button>
                </div>
              )}

              {/* Bloc facturation */}
              <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-[#f0f9ff] px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 shrink-0 text-sky-500" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-sky-800">🧾 Facturation</p>
                  <p className="text-xs text-sky-600">
                    Convertir ce devis en facture brouillon — tous les champs resteront éditables avant émission.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Facturation — à implémenter (R5)')}
                  className="shrink-0 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
                >
                  🧾 Créer une facture
                </button>
              </div>

            </div>
          )}

          {/* ══ Section Informations ══ */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informations</h3>

            {/* Ligne 1 : Société émettrice | Statut */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Société émettrice</label>
                <div className={roInputCls}>{tenantName || '—'}</div>
              </div>
              <div>
                <label className={labelCls}>Statut</label>
                <div className={`${roInputCls} flex items-center gap-2`}>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUT_META[statut].cls}`}>
                    {STATUT_META[statut].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Ligne 2 : N° Affaire | Commercial */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>N° Affaire</label>
                <div className={roInputCls}>
                  {editing?.affair_number ?? 'Auto-généré à la création'}
                </div>
              </div>
              <div>
                <label className={labelCls}>N° Devis</label>
                <div className={roInputCls}>
                  {editing?.number ?? 'Auto-généré à la création'}
                </div>
              </div>
            </div>

            {/* Ligne 2b : Commercial */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Commercial</label>
                <div className={`${roInputCls} font-sans`}>{commercialName}</div>
              </div>
              {/* Ligne 3 : Chef de projet (col 2) */}
              <div>
                <label className={labelCls}>Affecter à un chef de projet</label>
                <select
                  value={chefProjetId}
                  onChange={(e) => setChefProjetId(e.target.value)}
                  disabled={readonly}
                  className={inputCls}
                >
                  <option value="">— À affecter après validation —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 4 : Client */}
            <div>
              <label className={labelCls}>Client *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={readonly}
                className={inputCls}
                required
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>

            {/* Ligne 5 : Objet */}
            <div>
              <label className={labelCls}>Objet du devis</label>
              <input type="text" value={objet} disabled={readonly}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Objet du devis"
                className={inputCls} />
            </div>

            {/* Ligne 6 : Date | Validité */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={date} disabled={readonly}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Validité</label>
                <input type="date" value={validity} disabled={readonly}
                  onChange={(e) => setValidity(e.target.value)}
                  className={inputCls} />
                {!readonly && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {VALIDITY_DAYS.map((d) => (
                      <button key={d} type="button"
                        onClick={() => setValidityFromDays(d)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                        {d}j
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ Section Lignes ══ */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Lignes ({lignes.filter((l) => l.designation).length})
              </h3>
              {!readonly && (
                <button type="button" onClick={addEmptyLigne}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ligne vide
                </button>
              )}
            </div>

            {!readonly && (
              <>
                {/* Mini-cartes catalogue */}
                <CatalogueMiniCards catalogue={catalogue} onAdd={addFromCatalogueItem} />

                {/* Recherche catalogue */}
                <CatalogueSelector
                  catalogue={catalogue}
                  onSelect={addFromSelector}
                  placeholder="Rechercher dans le catalogue…"
                  className="mb-3"
                />
              </>
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

          {/* ══ Section Totaux ══ */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Totaux</h3>
            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total HT</span>
                <span className="font-medium">{fmtEur(totals.totalHT)}</span>
              </div>
              {totals.tvaGroups.map((g) =>
                g.amount > 0 ? (
                  <div key={g.rate} className="flex justify-between text-xs text-slate-500">
                    <span>TVA {g.rate} % (base {fmtEur(g.base)})</span>
                    <span>{fmtEur(g.amount)}</span>
                  </div>
                ) : null,
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                <span>Total TTC</span>
                <span className="text-base">{fmtEur(totals.totalTTC)}</span>
              </div>
              {totals.tvaAmount === 0 && (
                <p className="text-right text-xs text-slate-400">TVA non applicable</p>
              )}
              {depositPercent > 0 && (
                <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 text-xs text-slate-500">
                  <span>Acompte {depositPercent} %</span>
                  <span className="font-medium text-slate-700">
                    {fmtEur(+(totals.totalTTC * depositPercent / 100).toFixed(2))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ══ Section Conditions ══ */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Notes &amp; Conditions
            </h3>

            {/* Conditions de règlement | Acompte (grille 2 colonnes) */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelCls}>Acompte demandé (%)</label>
                <input
                  type="number" value={depositPercent} min={0} max={100} step={5}
                  disabled={readonly}
                  onChange={(e) => setDepositPercent(+e.target.value || 0)}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <div className="text-xs text-slate-400 pb-2">
                {depositPercent > 0
                  ? `Soit ${fmtEur(+(totals.totalTTC * depositPercent / 100).toFixed(2))} TTC`
                  : 'Aucun acompte'}
              </div>
            </div>

            <div>
              <label className={labelCls}>Conditions de règlement</label>
              <textarea
                value={conditions} disabled={readonly}
                onChange={(e) => setConditions(e.target.value)}
                rows={3}
                placeholder="Conditions de paiement, délais, mentions légales…"
                className={`${inputCls} resize-y`}
              />
            </div>

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
          </div>

        </div>{/* end scrollable */}

        {/* Erreur */}
        {error && (
          <div className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="shrink-0 flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          {editing && !confirmDel && (
            <button type="button" onClick={() => setConfirmDel(true)}
              className="mr-auto rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
              Supprimer
            </button>
          )}
          {editing && confirmDel && (
            <div className="mr-auto flex items-center gap-2">
              <span className="text-xs font-medium text-red-600">Confirmer ?</span>
              <button type="button" disabled={deleting} onClick={handleDelete}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              <button type="button" onClick={() => setConfirmDel(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              {readonly ? 'Fermer' : 'Annuler'}
            </button>
            {!readonly && (
              <button type="submit" disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le devis'}
              </button>
            )}
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
