'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import { SlideOver }         from '@/components/ui/SlideOver';
import { CatalogueSelector } from './CatalogueSelector';
import {
  saveInvoiceAction,
  deleteInvoiceAction,
  changeInvoiceStatusAction,
  createAvoirAction,
  setAvoirRefAction,
  saveEcheancierAction,
  getInvoiceLines,
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
  type InvoiceInput,
  type EcheancierEntry,
  type EcheancierStatut,
} from '@/app/actions/invoices';
import { fmtEur, fmtDate, todayISO, addDays } from '@/lib/format';
import type { CatalogueItem } from '@/app/actions/catalogue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon',  cls: 'bg-slate-100 text-slate-600' },
  emise:     { label: 'Émise',      cls: 'bg-blue-100 text-blue-700'   },
  payee:     { label: 'Payée',      cls: 'bg-green-100 text-green-700' },
  en_retard: { label: 'En retard',  cls: 'bg-red-100 text-red-600'     },
};

const TYPE_OPTIONS = [
  { value: 'materiel',    label: 'Matériel'     },
  { value: 'service',     label: 'Service'      },
  { value: 'forfait',     label: 'Forfait'      },
  { value: 'main_oeuvre', label: 'Main d\'œuvre' },
  { value: 'fourniture',  label: 'Fourniture'   },
];

const TVA_OPTIONS = [0, 5.5, 10, 20];

// ─── Ligne locale ─────────────────────────────────────────────────────────────

interface LineLocal {
  _id:              string;
  sort_order:       number;
  reference:        string;
  type:             string;
  designation:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  vat_rate:         number;
}

function emptyLine(): LineLocal {
  return {
    _id: uid(), sort_order: 0, reference: '', type: 'materiel',
    designation: '', quantity: 1, unit_price: 0, discount_percent: 0, vat_rate: 20,
  };
}

function lineToLocal(l: InvoiceLine, idx: number): LineLocal {
  return { _id: uid(), ...l, sort_order: idx };
}

function calcLineHT(l: LineLocal): number {
  return +(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toFixed(2);
}

// ─── Totaux ───────────────────────────────────────────────────────────────────

interface TvaGroup { rate: number; base: number; amount: number; }

function computeTotals(lines: LineLocal[]) {
  const groups = new Map<number, TvaGroup>();
  let totalHT = 0;
  for (const l of lines) {
    const ht = calcLineHT(l);
    totalHT += ht;
    if (!groups.has(l.vat_rate)) groups.set(l.vat_rate, { rate: l.vat_rate, base: 0, amount: 0 });
    const g = groups.get(l.vat_rate)!;
    g.base   += ht;
    g.amount += +(ht * l.vat_rate / 100).toFixed(2);
  }
  const tvaAmount = [...groups.values()].reduce((s, g) => s + g.amount, 0);
  return {
    totalHT:   +totalHT.toFixed(2),
    tvaAmount: +tvaAmount.toFixed(2),
    totalTTC:  +(totalHT + tvaAmount).toFixed(2),
    tvaGroups: [...groups.values()].sort((a, b) => a.rate - b.rate),
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls   = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';
const roInputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-500 cursor-not-allowed select-none';
const labelCls   = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';
const sectionCls = 'border-b border-slate-100 px-5 py-4 space-y-3';

// ─── LigneRow ─────────────────────────────────────────────────────────────────

function LigneRow({
  ligne, onChange, onDelete, readonly,
}: {
  ligne:    LineLocal;
  onChange: (l: LineLocal) => void;
  onDelete: () => void;
  readonly: boolean;
}) {
  function update(patch: Partial<LineLocal>) {
    onChange({ ...ligne, ...patch });
  }

  const cellCls = 'px-1.5 py-1 align-top';
  const numCls  = `${inputCls} text-right px-2 py-1.5 text-xs`;
  const txtCls  = `${inputCls} px-2 py-1.5 text-xs`;
  const ht      = calcLineHT(ligne);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className={cellCls} style={{ width: '80px' }}>
        <input type="text" value={ligne.reference} disabled={readonly}
          onChange={(e) => update({ reference: e.target.value })}
          className={txtCls} placeholder="Réf" />
      </td>
      <td className={cellCls} style={{ width: '90px' }}>
        <select value={ligne.type} disabled={readonly}
          onChange={(e) => update({ type: e.target.value })}
          className={`${txtCls} pr-1`}>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td className={cellCls}>
        <input type="text" value={ligne.designation} disabled={readonly}
          onChange={(e) => update({ designation: e.target.value })}
          className={txtCls} placeholder="Désignation *" />
      </td>
      <td className={cellCls} style={{ width: '75px' }}>
        <input type="number" value={ligne.quantity} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ quantity: +e.target.value || 0 })}
          className={numCls} />
      </td>
      <td className={cellCls} style={{ width: '95px' }}>
        <input type="number" value={ligne.unit_price} min={0} step="any" disabled={readonly}
          onChange={(e) => update({ unit_price: +e.target.value || 0 })}
          className={numCls} placeholder="0,00" />
      </td>
      <td className={cellCls} style={{ width: '72px', minWidth: '72px' }}>
        <select value={ligne.vat_rate} disabled={readonly}
          onChange={(e) => update({ vat_rate: +e.target.value })}
          className={`${txtCls} pr-1`}
          style={{ minWidth: '66px' }}>
          {TVA_OPTIONS.map((t) => <option key={t} value={t}>{t} %</option>)}
        </select>
      </td>
      <td className={cellCls} style={{ width: '72px', minWidth: '72px' }}>
        <input type="number" value={ligne.discount_percent} min={0} max={100} step="any" disabled={readonly}
          onChange={(e) => update({ discount_percent: +e.target.value || 0 })}
          className={numCls} placeholder="0"
          style={{ minWidth: '64px' }} />
      </td>
      <td className={cellCls} style={{ width: '90px' }}>
        <div className="py-1.5 px-2 text-right text-xs font-semibold text-slate-700">
          {fmtEur(ht)}
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceFormProps {
  open:       boolean;
  onClose:    () => void;
  editing:    Invoice | null;
  clients:    { id: string; nom: string }[];
  catalogue:  CatalogueItem[];
  companies?: { id: string; name: string }[];
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function InvoiceForm({ open, onClose, editing, clients, catalogue, companies = [] }: InvoiceFormProps) {
  const router = useRouter();

  const [clientId,     setClientId]     = useState('');
  const [companyId,    setCompanyId]    = useState('');
  const [dateFact,     setDateFact]     = useState(todayISO());
  const [dateEch,      setDateEch]      = useState(addDays(todayISO(), 30));
  const [conditions,   setConditions]   = useState('');
  const [notes,        setNotes]        = useState('');
  const [lines,        setLines]        = useState<LineLocal[]>([emptyLine()]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [localStatus,  setLocalStatus]  = useState<InvoiceStatus | null>(null);

  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error,      setError]      = useState('');
  const [avoirModal, setAvoirModal] = useState(false);
  const [avoirMode,  setAvoirMode]  = useState<'total' | 'partiel'>('total');
  const [avoirMt,    setAvoirMt]    = useState('');
  const [avoirBusy,       setAvoirBusy]       = useState(false);
  const [echeancier,      setEcheancier]      = useState<EcheancierEntry[]>([]);
  const [echeancierModal, setEcheancierModal] = useState(false);
  const [modalEch,        setModalEch]        = useState<EcheancierEntry[]>([]);
  const [echBusy,         setEchBusy]         = useState(false);

  // localStatus prend le dessus sur la prop (qui ne change pas après action serveur)
  const status   = localStatus ?? ((editing?.status ?? 'brouillon') as InvoiceStatus);
  const readonly = status !== 'brouillon';

  // ── Sync state ──
  useEffect(() => {
    if (!open) return;
    setLocalStatus(null);
    setClientId(editing?.client_id ?? '');
    setCompanyId(editing?.company_id ?? (companies.length === 1 ? companies[0].id : ''));
    setDateFact(editing?.date_facture ?? todayISO());
    setDateEch(editing?.date_echeance ?? addDays(todayISO(), 30));
    setConditions(editing?.conditions ?? '');
    setNotes(editing?.notes ?? '');
    setEcheancier(editing?.echeancier ?? []);
    setError('');
    setConfirmDel(false);
    setAvoirModal(false);
    setAvoirMode('total');
    setAvoirMt('');

    if (editing) {
      setLoadingLines(true);
      getInvoiceLines(editing.id).then((fetched) => {
        setLines(fetched.length > 0 ? fetched.map(lineToLocal) : [emptyLine()]);
        setLoadingLines(false);
      });
    } else {
      setLines([emptyLine()]);
    }
  }, [open, editing]);

  // ── Lignes ──
  const updateLine = useCallback((idx: number, l: LineLocal) => {
    setLines((prev) => prev.map((p, i) => i === idx ? l : p));
  }, []);

  const deleteLine = useCallback((idx: number) => {
    setLines((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  function addEmptyLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function addFromCatalogue(item: CatalogueItem) {
    const l: LineLocal = {
      _id: uid(), sort_order: 0,
      reference:        item.ref ?? '',
      type:             item.type,
      designation:      item.designation,
      quantity:         1,
      unit_price:       item.prix_vente,
      discount_percent: 0,
      vat_rate:         item.tva,
    };
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.designation && last.unit_price === 0) {
        return [...prev.slice(0, -1), l];
      }
      return [...prev, l];
    });
  }

  function addFromSelector(item: import('./CatalogueSelector').CatalogueSelectorResult) {
    const l: LineLocal = {
      _id: uid(), sort_order: 0,
      reference:        item.reference,
      type:             'materiel',
      designation:      item.designation,
      quantity:         1,
      unit_price:       item.prix_vente,
      discount_percent: 0,
      vat_rate:         item.tva,
    };
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.designation && last.unit_price === 0) {
        return [...prev.slice(0, -1), l];
      }
      return [...prev, l];
    });
  }

  // ── Totaux ──
  const totals = useMemo(() => computeTotals(lines), [lines]);

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    const validLines = lines.filter((l) => l.designation.trim());
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne.'); return; }

    const input: InvoiceInput = {
      client_id:     clientId,
      company_id:    companyId || null,
      quote_id:      editing?.quote_id ?? null,
      quote_number:  editing?.quote_number ?? null,
      date_facture:  dateFact,
      date_echeance: dateEch,
      status:        isAvoir ? status : 'brouillon',
      conditions,
      notes,
      lines: validLines.map((l, i) => ({
        sort_order:       i,
        reference:        l.reference,
        type:             l.type,
        designation:      l.designation,
        quantity:         l.quantity,
        unit_price:       l.unit_price,
        discount_percent: l.discount_percent,
        vat_rate:         l.vat_rate,
      })),
      total_ht:   totals.totalHT,
      total_tva:  totals.tvaAmount,
      total_ttc:  totals.totalTTC,
      echeancier: echeancier.filter((e) => e.montant > 0),
    };

    setSaving(true); setError('');
    const res = await saveInvoiceAction(input, editing?.id);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Delete ──
  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    const res = await deleteInvoiceAction(editing.id);
    setDeleting(false);
    if (res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Statut ──
  async function handleStatus(s: InvoiceStatus) {
    if (!editing) return;
    setStatusBusy(true);
    const res = await changeInvoiceStatusAction(editing.id, s);
    setStatusBusy(false);
    if (res.error) { setError(res.error); return; }
    setLocalStatus(s);
    router.refresh();
  }

  // ── Avoir ──
  async function handleAvoir() {
    if (!editing) return;
    setAvoirBusy(true);
    const mt = avoirMode === 'partiel' ? parseFloat(avoirMt.replace(',', '.')) : undefined;
    if (avoirMode === 'partiel' && (!mt || mt <= 0)) {
      setError('Montant partiel invalide.');
      setAvoirBusy(false);
      return;
    }
    const res = await createAvoirAction(editing.id, avoirMode, mt);
    setAvoirBusy(false);
    if (res.error) { setError(res.error); return; }
    setAvoirModal(false);
    onClose();
  }

  // ── Écheancier modal ──
  function openEcheancierModal() {
    setModalEch(echeancier.length > 0 ? echeancier : []);
    setEcheancierModal(true);
  }

  function addModalEntry() {
    const restant = (editing?.total_ttc ?? 0) - modalEch.reduce((s, e) => s + e.montant, 0);
    setModalEch((prev) => [...prev, {
      date:   addDays(editing?.date_echeance ?? todayISO(), 0),
      montant: Math.max(0, +restant.toFixed(2)),
      statut: 'En attente',
    }]);
  }

  function handleVentilation() {
    const ttc = editing?.total_ttc ?? 0;
    const acompte = +(ttc * 0.3).toFixed(2);
    const solde   = +(ttc - acompte).toFixed(2);
    setModalEch([
      { date: todayISO(),                 montant: acompte, statut: 'En attente' },
      { date: addDays(todayISO(), 30),    montant: solde,   statut: 'En attente' },
    ]);
  }

  async function handleSaveEcheancier() {
    if (!editing) return;
    setEchBusy(true);
    const res = await saveEcheancierAction(editing.id, modalEch);
    setEchBusy(false);
    if (res.error) { setError(res.error); return; }
    setEcheancier(modalEch);
    setEcheancierModal(false);
    router.refresh();
  }

  // ── Émettre l'avoir ──
  async function handleEmettre() {
    if (!editing) return;
    setStatusBusy(true);
    const res = await changeInvoiceStatusAction(editing.id, 'emise');
    if (res.error) { setError(res.error); setStatusBusy(false); return; }
    // Stamper avoir_ref sur la facture source
    if (editing.avoir_de_id) {
      await setAvoirRefAction(editing.avoir_de_id, editing.number);
    }
    setStatusBusy(false);
    setLocalStatus('emise');
    router.refresh();
  }

  const isAvoir  = editing?.type === 'avoir';
  const title    = isAvoir
    ? `Avoir ${editing!.number}`
    : editing ? `Facture ${editing.number}` : 'Nouvelle facture';

  return (
    <SlideOver open={open} onClose={onClose} title={title} width="xl">
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">

          {/* ── Barre statut ── */}
          {editing && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
              {isAvoir ? (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  Avoir — {status === 'brouillon' ? 'Brouillon' : status === 'emise' ? 'Émis' : 'Payé'}
                </span>
              ) : (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[status].cls}`}>
                  {STATUS_META[status].label}
                </span>
              )}

              {isAvoir && status === 'brouillon' && (
                <button type="button" disabled={statusBusy} onClick={handleEmettre}
                  className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors">
                  📤 Émettre l'avoir
                </button>
              )}

              {!isAvoir && (status === 'emise' || status === 'en_retard') && (
                <button type="button" onClick={openEcheancierModal}
                  className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors">
                  📅 Échéancier
                </button>
              )}

              {!isAvoir && status === 'brouillon' && (
                <button type="button" disabled={statusBusy} onClick={() => handleStatus('emise')}
                  className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                  → Émettre la facture
                </button>
              )}
              {!isAvoir && status === 'emise' && (
                <>
                  <button type="button" disabled={statusBusy} onClick={() => handleStatus('payee')}
                    className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors">
                    ✓ Marquer comme payée
                  </button>
                  <button type="button" disabled={statusBusy} onClick={() => handleStatus('brouillon')}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                    ↩ Repasser en brouillon
                  </button>
                </>
              )}

              {/* Bouton créer un avoir (sur factures émises ou payées sans avoir) */}
              {!isAvoir && (status === 'emise' || status === 'payee') && !editing.avoir_ref && (
                <button type="button" onClick={() => setAvoirModal(true)}
                  className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors">
                  Créer un avoir
                </button>
              )}
              {!isAvoir && editing.avoir_ref && (
                <span className="rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-medium text-violet-600">
                  Avoir : {editing.avoir_ref}
                </span>
              )}

              {readonly && <span className="ml-auto text-xs italic text-slate-400">Lecture seule</span>}
            </div>
          )}

          {/* ── Bannière avoir ── */}
          {isAvoir && editing?.avoir_de && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              Avoir sur la facture&nbsp;
              <span className="font-mono font-semibold">{editing.avoir_de}</span>
            </div>
          )}

          {/* ── Lien devis source ── */}
          {editing?.quote_number && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
              Depuis le devis&nbsp;
              <span className="font-mono font-semibold">{editing.quote_number}</span>
              <a href="/commerce?tab=devis" className="ml-auto font-semibold underline hover:no-underline">
                Voir le devis →
              </a>
            </div>
          )}

          {/* ══ Informations ══ */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informations</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>N° Facture</label>
                <div className={roInputCls}>{editing?.number ?? 'Auto-généré'}</div>
              </div>
              <div>
                <label className={labelCls}>Statut</label>
                <div className={`${roInputCls} flex items-center gap-2`}>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[status].cls}`}>
                    {STATUS_META[status].label}
                  </span>
                </div>
              </div>
            </div>

            {companies.length > 0 && (
              <div>
                <label className={labelCls}>Société émettrice</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                  disabled={readonly} className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                disabled={readonly} className={inputCls} required>
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date facture</label>
                <input type="date" value={dateFact} disabled={readonly}
                  onChange={(e) => setDateFact(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date d'échéance</label>
                <input type="date" value={dateEch} disabled={readonly}
                  onChange={(e) => setDateEch(e.target.value)}
                  className={inputCls} />
                {!readonly && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[15, 30, 45, 60].map((d) => (
                      <button key={d} type="button"
                        onClick={() => setDateEch(addDays(dateFact, d))}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                        +{d}j
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ Lignes ══ */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Lignes ({lines.filter((l) => l.designation).length})
              </h3>
              {!readonly && (
                <button type="button" onClick={addEmptyLine}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ligne vide
                </button>
              )}
            </div>

            {!readonly && (
              <CatalogueSelector
                catalogue={catalogue}
                onSelect={addFromSelector}
                placeholder="Rechercher dans le catalogue…"
                className="mb-3"
              />
            )}

            {loadingLines ? (
              <p className="py-6 text-center text-xs text-slate-400">Chargement des lignes…</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400">
                      <th className="px-1.5 py-2 text-left">Réf</th>
                      <th className="px-1.5 py-2 text-left">Type</th>
                      <th className="px-1.5 py-2 text-left">Désignation</th>
                      <th className="px-1.5 py-2 text-right">Qté</th>
                      <th className="px-1.5 py-2 text-right">PU HT</th>
                      <th className="px-1.5 py-2 text-right">TVA</th>
                      <th className="px-1.5 py-2 text-right">Remise</th>
                      <th className="px-1.5 py-2 text-right">Total HT</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <LigneRow
                        key={l._id}
                        ligne={l}
                        onChange={(updated) => updateLine(idx, updated)}
                        onDelete={() => deleteLine(idx)}
                        readonly={readonly}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ajout rapide catalogue */}
            {!readonly && catalogue.filter((c) => c.actif).slice(0, 6).length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Ajout rapide :
                </p>
                <div className="flex flex-wrap gap-2">
                  {catalogue.filter((c) => c.actif).slice(0, 6).map((item) => (
                    <button key={item.id} type="button" onClick={() => addFromCatalogue(item)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:shadow-sm transition-all">
                      {item.designation.length > 25 ? item.designation.slice(0, 25) + '…' : item.designation}
                      <span className="ml-1.5 text-slate-400">{item.prix_vente.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══ Totaux ══ */}
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
            </div>
          </div>

          {/* ══ Conditions ══ */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Notes &amp; Conditions
            </h3>
            <div>
              <label className={labelCls}>Conditions de règlement</label>
              <textarea value={conditions} disabled={readonly}
                onChange={(e) => setConditions(e.target.value)}
                rows={3} placeholder="Conditions de paiement…"
                className={`${inputCls} resize-y`} />
            </div>
            <div>
              <label className={labelCls}>Notes internes</label>
              <textarea value={notes} disabled={readonly}
                onChange={(e) => setNotes(e.target.value)}
                rows={2} placeholder="Notes internes…"
                className={`${inputCls} resize-y`} />
            </div>
          </div>

          {/* ══ Échéancier (brouillon uniquement — emise utilise le bouton modal) ══ */}
          {!isAvoir && status === 'brouillon' && (
            <div className={sectionCls}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Échéancier de paiement
                </h3>
                <button type="button"
                  onClick={() => setEcheancier((prev) => [...prev, {
                    date: addDays(dateFact, 30), montant: 0, statut: 'En attente' as EcheancierStatut,
                  }])}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter une échéance
                </button>
              </div>
              {echeancier.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucun échéancier — paiement en une fois à l&apos;échéance.</p>
              ) : (
                <div className="space-y-2">
                  {echeancier.map((ech, idx) => {
                    const st: EcheancierStatut = ech.statut ?? (ech.paye ? 'Encaissé' : 'En attente');
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="date" value={ech.date}
                          onChange={(e) => setEcheancier((prev) => prev.map((x, i) => i === idx ? { ...x, date: e.target.value } : x))}
                          className={`${inputCls} flex-1 min-w-0`} />
                        <input type="number" value={ech.montant} min={0} step="any"
                          placeholder="Montant"
                          onChange={(e) => setEcheancier((prev) => prev.map((x, i) => i === idx ? { ...x, montant: +e.target.value || 0 } : x))}
                          className={`${inputCls} w-28 text-right`} />
                        <select value={st}
                          onChange={(e) => setEcheancier((prev) => prev.map((x, i) => i === idx ? { ...x, statut: e.target.value as EcheancierStatut, paye: e.target.value === 'Encaissé' } : x))}
                          className={`${inputCls} w-32`}>
                          <option>En attente</option>
                          <option>Encaissé</option>
                          <option>Retard</option>
                        </select>
                        <button type="button"
                          onClick={() => setEcheancier((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <span>Total planifié : {fmtEur(echeancier.reduce((s, e) => s + e.montant, 0))}</span>
                    <span className="text-green-600">Encaissé : {fmtEur(echeancier.filter((e) => (e.statut ?? (e.paye ? 'Encaissé' : '')) === 'Encaissé').reduce((s, e) => s + e.montant, 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Erreur */}
        {error && (
          <div className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="shrink-0 flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          {/* Supprimer — seulement brouillon */}
          {editing && status === 'brouillon' && !confirmDel && (
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
            {editing && (
              <button
                type="button"
                onClick={() => window.open(`/api/pdf/facture/${editing.id}`, '_blank')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                📄 PDF
              </button>
            )}
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              {readonly ? 'Fermer' : 'Annuler'}
            </button>
            {!readonly && (
              <button type="submit" disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la facture'}
              </button>
            )}
          </div>
        </div>
      </form>
      {/* ── Modal avoir ── */}
      {/* ── Modal Échéancier ── */}
      {echeancierModal && editing && (() => {
        const encaisse = modalEch.filter((e) => (e.statut ?? (e.paye ? 'Encaissé' : '')) === 'Encaissé').reduce((s, e) => s + e.montant, 0);
        const restant  = +(editing.total_ttc - encaisse).toFixed(2);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setEcheancierModal(false)} />
            <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-base font-bold text-slate-800">📅 Échéancier de paiement</h3>
                <button type="button" onClick={() => setEcheancierModal(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4 border-b border-slate-100 px-6 py-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total TTC</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-800">{fmtEur(editing.total_ttc)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Encaissé</p>
                  <p className="mt-1 text-lg font-extrabold text-green-600">{fmtEur(encaisse)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Restant</p>
                  <p className={`mt-1 text-lg font-extrabold ${restant > 0 ? 'text-orange-500' : 'text-green-600'}`}>{fmtEur(restant)}</p>
                </div>
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {modalEch.length === 0 && (
                  <p className="text-sm text-slate-400 italic py-2">Aucune échéance définie.</p>
                )}
                {modalEch.map((ech, idx) => {
                  const st: EcheancierStatut = ech.statut ?? (ech.paye ? 'Encaissé' : 'En attente');
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="date" value={ech.date}
                        onChange={(e) => setModalEch((prev) => prev.map((x, i) => i === idx ? { ...x, date: e.target.value } : x))}
                        className={`${inputCls} flex-1`} />
                      <input type="number" value={ech.montant} min={0} step="0.01"
                        onChange={(e) => setModalEch((prev) => prev.map((x, i) => i === idx ? { ...x, montant: +e.target.value || 0 } : x))}
                        className={`${inputCls} w-28 text-right`} />
                      <select value={st}
                        onChange={(e) => setModalEch((prev) => prev.map((x, i) => i === idx ? { ...x, statut: e.target.value as EcheancierStatut } : x))}
                        className={`${inputCls} w-32`}>
                        <option>En attente</option>
                        <option>Encaissé</option>
                        <option>Retard</option>
                      </select>
                      <button type="button"
                        onClick={() => setModalEch((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {/* Ventilation rapide */}
                {restant > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <button type="button" onClick={handleVentilation}
                      className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                      ⚡ Créer acompte 30 % + solde 70 %
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={addModalEntry}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter une échéance
                </button>
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => setEcheancierModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Annuler
                  </button>
                  <button type="button" disabled={echBusy} onClick={handleSaveEcheancier}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {echBusy ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {avoirModal && editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAvoirModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Créer un avoir</h3>
            <p className="text-sm text-slate-500">
              Facture <span className="font-mono font-semibold">{editing.number}</span> — {fmtEur(editing.total_ttc)}
            </p>

            {/* Mode */}
            <div className="flex gap-3">
              {(['total', 'partiel'] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => setAvoirMode(m)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    avoirMode === m
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {m === 'total' ? 'Avoir total' : 'Avoir partiel'}
                </button>
              ))}
            </div>

            {avoirMode === 'partiel' && (
              <div>
                <label className={labelCls}>Montant TTC de l&apos;avoir</label>
                <input type="number" value={avoirMt} min={0} step="0.01"
                  onChange={(e) => setAvoirMt(e.target.value)}
                  placeholder="0,00"
                  className={inputCls} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAvoirModal(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button type="button" disabled={avoirBusy} onClick={handleAvoir}
                className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {avoirBusy ? 'Création…' : 'Créer l\'avoir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}
