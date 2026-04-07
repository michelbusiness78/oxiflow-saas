'use client';

import { useState, useMemo, useTransition } from 'react';
import { InvoiceForm }        from './InvoiceForm';
import { fmtEur, fmtDate }    from '@/lib/format';
import type { Invoice, InvoiceStatus } from '@/app/actions/invoices';
import type { CatalogueItem }          from '@/app/actions/catalogue';
import type { RelanceNiveau }          from '@/lib/relance-templates';
import { getEmailTemplate }            from '@/lib/relance-templates';
import { marquerRelanceAction }        from '@/app/actions/relances';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600'  },
  emise:     { label: 'Émise',     cls: 'bg-blue-100 text-blue-700'    },
  payee:     { label: 'Payée',     cls: 'bg-green-100 text-green-700'  },
  en_retard: { label: 'En retard', cls: 'bg-red-100 text-red-600'      },
};

const FILTERS: Array<InvoiceStatus | 'tous' | 'avoirs'> = ['tous', 'brouillon', 'emise', 'payee', 'en_retard', 'avoirs'];

const NIVEAU_META: Record<RelanceNiveau, { icon: string; cls: string; label: string }> = {
  1: { icon: '⏰', cls: 'bg-amber-100 text-amber-700',  label: 'Relance 1' },
  2: { icon: '⚠',  cls: 'bg-orange-100 text-orange-700', label: 'Relance 2' },
  3: { icon: '🔴', cls: 'bg-red-100 text-red-700',       label: 'Urgent'    },
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function retardDays(inv: Invoice): number {
  if (!inv.date_echeance) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(inv.date_echeance).getTime()) / 86_400_000));
}

function niveauPending(inv: Invoice): { niveau: RelanceNiveau; jours: number } | null {
  if (inv.status !== 'emise' && inv.status !== 'en_retard') return null;
  if (!inv.date_echeance) return null;
  const jours = retardDays(inv);
  if (jours >= 30 && !inv.relance_n3) return { niveau: 3, jours };
  if (jours >= 15 && !inv.relance_n2) return { niveau: 2, jours };
  if (jours >= 5  && !inv.relance_n1) return { niveau: 1, jours };
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceListProps {
  invoices:      Invoice[];
  clients:       { id: string; nom: string; email?: string | null }[];
  catalogue:     CatalogueItem[];
  companies?:    { id: string; name: string }[];
  nomSociete?:   string;
  telSociete?:   string;
  defaultFilter?: string;
  defaultCompany?: string;
}

// ─── Relance SlideOver ────────────────────────────────────────────────────────

function RelancePanel({
  invoice,
  clientEmail,
  nomSociete,
  telSociete,
  niveau,
  onClose,
  onDone,
}: {
  invoice:     Invoice;
  clientEmail: string;
  nomSociete:  string;
  telSociete:  string;
  niveau:      RelanceNiveau;
  onClose:     () => void;
  onDone:      () => void;
}) {
  const [email,   setEmail]   = useState(clientEmail);
  const [pending, startTrans] = useTransition();
  const [copied,  setCopied]  = useState(false);
  const [toast,   setToast]   = useState('');

  const tpl = getEmailTemplate(niveau, {
    numero_facture: invoice.number,
    date_facture:   invoice.date_facture,
    date_echeance:  invoice.date_echeance,
    montant_ttc:    invoice.total_ttc,
    nom_client:     invoice.client_nom ?? '—',
    nom_societe:    nomSociete,
    tel_societe:    telSociete,
  });

  const [objet, setObjet] = useState(tpl.objet);
  const [corps, setCorps] = useState(tpl.corps);

  function copyAll() {
    navigator.clipboard.writeText(`À : ${email}\nObjet : ${objet}\n\n${corps}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMark() {
    startTrans(async () => {
      // currentUserName is server-side — use email as fallback
      const res = await marquerRelanceAction(invoice.id, niveau, email, email);
      if (res.error) {
        setToast(`Erreur : ${res.error}`);
      } else {
        onDone();
      }
    });
  }

  const meta = NIVEAU_META[niveau];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {meta.icon} {meta.label} — {invoice.number}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtEur(invoice.total_ttc)} · Échéance {fmtDate(invoice.date_echeance)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Niveau badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}>
            {meta.icon} Niveau {niveau} — J+{retardDays(invoice)}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Destinataire</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Objet */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Objet</label>
            <input
              type="text"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Corps */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
            <textarea
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
            />
          </div>

          {/* Historique relances déjà envoyées */}
          {(invoice.relance_n1 || invoice.relance_n2) && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-600 mb-1">Relances précédentes :</p>
              {[1, 2].map((n) => {
                const r = n === 1 ? invoice.relance_n1 : invoice.relance_n2;
                if (!r) return null;
                return (
                  <p key={n}>N{n} — {fmtDate(r.date)} → {r.email}</p>
                );
              })}
            </div>
          )}

          {toast && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{toast}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-200">
          <button
            onClick={copyAll}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {copied ? '✓ Copié !' : 'Copier le message'}
          </button>
          <button
            onClick={handleMark}
            disabled={pending || !email}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {pending ? 'Enregistrement…' : 'Marquer relancé'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

function resolveFilter(raw?: string): InvoiceStatus | 'tous' | 'avoirs' {
  if (!raw) return 'tous';
  if (raw === 'retard') return 'en_retard';
  const valid: Array<InvoiceStatus | 'tous' | 'avoirs'> = ['tous', 'brouillon', 'emise', 'payee', 'en_retard', 'avoirs'];
  return valid.includes(raw as InvoiceStatus | 'tous' | 'avoirs')
    ? (raw as InvoiceStatus | 'tous' | 'avoirs')
    : 'tous';
}

export function InvoiceList({ invoices, clients, catalogue, companies = [], nomSociete = '', telSociete = '', defaultFilter, defaultCompany }: InvoiceListProps) {
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'tous' | 'avoirs'>(() => resolveFilter(defaultFilter));
  const [search,       setSearch]       = useState('');
  const [relancingInv, setRelancingInv] = useState<Invoice | null>(null);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(inv: Invoice) { setEditing(inv); setFormOpen(true); }

  // Compteurs par statut
  const counts = useMemo(() => {
    const c: Partial<Record<InvoiceStatus | 'tous' | 'avoirs', number>> = {
      tous:   invoices.filter((i) => i.type !== 'avoir').length,
      avoirs: invoices.filter((i) => i.type === 'avoir').length,
    };
    for (const inv of invoices) {
      if (inv.type !== 'avoir') c[inv.status] = (c[inv.status] ?? 0) + 1;
    }
    return c;
  }, [invoices]);

  // Filtrage + recherche
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return invoices.filter((inv) => {
      if (defaultCompany && inv.company_id !== defaultCompany) return false;
      if (statusFilter === 'avoirs') {
        if (inv.type !== 'avoir') return false;
      } else if (statusFilter !== 'tous') {
        if (inv.type === 'avoir') return false;
        if (inv.status !== statusFilter) return false;
      } else {
        // 'tous' = toutes les factures sauf les avoirs
        if (inv.type === 'avoir') return false;
      }
      if (q && !(
        normalize(inv.number).includes(q) ||
        normalize(inv.client_nom ?? '').includes(q) ||
        normalize(inv.quote_number ?? '').includes(q)
      )) return false;
      return true;
    });
  }, [invoices, statusFilter, search, defaultCompany]);

  // Lookup client email
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) if (c.email) m.set(c.id, c.email);
    return m;
  }, [clients]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° facture, client, N° devis…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* Chips statut */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((s) => {
          const count  = counts[s] ?? 0;
          const active = statusFilter === s;
          const label  = s === 'tous' ? 'Toutes' : s === 'avoirs' ? 'Avoirs' : STATUS_META[s as InvoiceStatus].label;
          const cls    = s === 'tous' ? 'bg-slate-800 text-white'
            : s === 'avoirs' ? 'bg-violet-100 text-violet-700'
            : STATUS_META[s as InvoiceStatus].cls;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? cls + (s !== 'tous' ? ' ring-2 ring-offset-1' : '')
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">{count}</span>}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">{filtered.length} facture{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400 mb-3">
            {search || statusFilter !== 'tous' ? 'Aucun résultat pour ces filtres.' : 'Aucune facture.'}
          </p>
          {!search && statusFilter === 'tous' && (
            <button onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Créer une facture
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">N° Facture</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Statut</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Échéance</th>
                <th className="px-4 py-3 text-right">TTC</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const pending = niveauPending(inv);
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(inv)}
                  >
                    {/* N° + badges */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`font-mono text-sm font-semibold whitespace-nowrap ${inv.type === 'avoir' ? 'text-violet-700' : 'text-slate-700'}`}>
                          {inv.number}
                        </span>
                        {inv.type === 'avoir' && inv.avoir_de && (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 whitespace-nowrap">
                            AV ← {inv.avoir_de}
                          </span>
                        )}
                        {inv.avoir_ref && (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 whitespace-nowrap">
                            AV: {inv.avoir_ref}
                          </span>
                        )}
                        {inv.quote_number && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 whitespace-nowrap">
                            ← {inv.quote_number}
                          </span>
                        )}
                        {pending && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${NIVEAU_META[pending.niveau].cls}`}>
                            {NIVEAU_META[pending.niveau].icon} J+{pending.jours}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {inv.client_nom}
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[inv.status].cls}`}>
                        {STATUS_META[inv.status].label}
                      </span>
                    </td>

                    {/* Date facture */}
                    <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
                      {fmtDate(inv.date_facture)}
                    </td>

                    {/* Échéance */}
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell whitespace-nowrap ${inv.status === 'en_retard' ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
                      {fmtDate(inv.date_echeance)}
                    </td>

                    {/* Montant TTC */}
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-800 whitespace-nowrap">
                      {fmtEur(inv.total_ttc)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {pending && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRelancingInv(inv); }}
                            className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${NIVEAU_META[pending.niveau].cls} hover:opacity-80`}
                            title={`Relancer (niveau ${pending.niveau})`}
                          >
                            Relancer
                          </button>
                        )}
                        <button type="button" onClick={() => openEdit(inv)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800 transition-colors"
                          title="Ouvrir">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        clients={clients}
        catalogue={catalogue}
        companies={companies}
      />

      {relancingInv && (() => {
        const pending = niveauPending(relancingInv);
        if (!pending) return null;
        return (
          <RelancePanel
            invoice={relancingInv}
            clientEmail={clientMap.get(relancingInv.client_id) ?? ''}
            nomSociete={nomSociete}
            telSociete={telSociete}
            niveau={pending.niveau}
            onClose={() => setRelancingInv(null)}
            onDone={() => setRelancingInv(null)}
          />
        );
      })()}
    </>
  );
}
