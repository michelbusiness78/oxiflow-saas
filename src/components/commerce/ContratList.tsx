'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ContratForm, type Contrat } from './ContratForm';
import { fmtEur, fmtDate } from '@/lib/format';
import { deleteContratAction, factureContratAction, renouvellerContratAction } from '@/app/actions/contrats';
import type { ContratStatut } from '@/app/actions/contrats';
import type { Invoice } from '@/app/actions/invoices';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client   { id: string; nom: string; }
interface Company  { id: string; name: string; }
interface Project  { id: string; name: string; client_id: string | null; }

interface ContratWithClient extends Contrat {
  client_nom?: string;
}

interface ContratListProps {
  contrats:  ContratWithClient[];
  clients:   Client[];
  companies: Company[];
  projects:  Project[];
  invoices?: Invoice[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_LABELS  = { maintenance: 'Maintenance', support: 'Support', location: 'Location' };
const TYPE_VARIANT = { maintenance: 'info', support: 'primary', location: 'warning' } as const;

const FREQ_LABELS: Record<string, string> = {
  mensuel: 'Mensuel', trimestriel: 'Trimestriel', annuel: 'Annuel',
};

const STATUT_META: Record<ContratStatut, { label: string; bg: string; text: string; dot: string }> = {
  actif:   { label: 'Actif',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  expire:  { label: 'Expiré',   bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  resilie: { label: 'Résilié',  bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

type Filter = 'tous' | ContratStatut | 'a_renouveler';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEffectiveStatut(c: ContratWithClient): ContratStatut {
  if (c.statut) return c.statut as ContratStatut;
  if (!c.actif) return 'resilie';
  if (c.date_fin && new Date(c.date_fin) < new Date()) return 'expire';
  return 'actif';
}

function expiresInDays(c: ContratWithClient): number | null {
  if (!c.date_fin) return null;
  const d = Math.ceil((new Date(c.date_fin).getTime() - Date.now()) / 86_400_000);
  return d;
}

function periodeDays(frequence: string | null): number {
  if (frequence === 'trimestriel') return 90;
  if (frequence === 'annuel')      return 365;
  return 30;
}

const INV_STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  emise:     { label: 'Émise',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  payee:     { label: 'Payée',     bg: 'bg-green-100',  text: 'text-green-700'  },
  en_retard: { label: 'En retard', bg: 'bg-red-100',    text: 'text-red-700'    },
  brouillon: { label: 'Brouillon', bg: 'bg-slate-100',  text: 'text-slate-500'  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ContratList({ contrats, clients, companies, projects, invoices = [] }: ContratListProps) {
  const [filter,       setFilter]       = useState<Filter>('tous');
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<Contrat | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [facturantId,  setFacturantId]  = useState<string | null>(null);
  const [factureToast, setFactureToast] = useState('');
  const [renewId,      setRenewId]      = useState<string | null>(null);
  const [renewLabel,   setRenewLabel]   = useState('');
  const [renewToast,   setRenewToast]   = useState('');
  const [renewing,     setRenewing]     = useState(false);
  const [isPending,    startTransition] = useTransition();

  // Index last contrat invoice per client_id
  const lastInvByClient = new Map<string, Invoice>();
  for (const inv of invoices) {
    if (inv.type !== 'contrat') continue;
    const existing = lastInvByClient.get(inv.client_id);
    if (!existing || inv.date_facture > existing.date_facture) {
      lastInvByClient.set(inv.client_id, inv);
    }
  }

  async function handleFacturer(contratId: string) {
    setFacturantId(contratId);
    startTransition(async () => {
      const res = await factureContratAction(contratId);
      setFacturantId(null);
      if ('error' in res && res.error) { setError(res.error); return; }
      if (res.number) {
        setFactureToast(`Facture ${res.number} créée`);
        setTimeout(() => setFactureToast(''), 4000);
      }
    });
  }

  async function handleRenew() {
    if (!renewId) return;
    setRenewing(true);
    const res = await renouvellerContratAction(renewId);
    setRenewing(false);
    if ('error' in res && res.error) { setError(res.error); setRenewId(null); return; }
    setRenewId(null);
    if (res.newDateFin) {
      setRenewToast(`Contrat renouvelé jusqu'au ${fmtDate(res.newDateFin)}`);
      setTimeout(() => setRenewToast(''), 5000);
    }
  }

  function openRenew(c: ContratWithClient & { _statut: ContratStatut }) {
    if (!c.date_fin) return;
    const dateFin    = new Date(c.date_fin);
    const dateDebut  = new Date(c.date_debut);
    const durationMs = dateFin.getTime() - dateDebut.getTime();
    const newStart   = new Date(dateFin.getTime() + 86_400_000);
    const newEnd     = new Date(newStart.getTime() + durationMs);
    const newEndStr  = newEnd.toISOString().split('T')[0];
    setRenewId(c.id);
    setRenewLabel(
      `Renouveler « ${c.nom ?? TYPE_LABELS[c.type]} » pour une nouvelle période ?\n` +
      `Nouvelle période : ${fmtDate(newStart.toISOString().split('T')[0])} → ${fmtDate(newEndStr)}`,
    );
  }

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  // Normalise statut for each contrat
  const normalized = contrats.map((c) => ({ ...c, _statut: getEffectiveStatut(c) }));

  // Helper: contrat nécessitant renouvellement (actif + date_fin dans ≤30j ou dépassée)
  const isARenouveler = (c: typeof normalized[number]) =>
    c._statut === 'actif' && c.date_fin !== null && expiresInDays(c) !== null && expiresInDays(c)! <= 30;

  // Filter
  const afterFilter = filter === 'tous'         ? normalized
                    : filter === 'a_renouveler' ? normalized.filter(isARenouveler)
                    : normalized.filter((c) => c._statut === filter);

  // Search
  const visible = search
    ? afterFilter.filter((c) =>
        [c.client_nom, c.nom, c.numero].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : afterFilter;

  // KPIs
  const actifs          = normalized.filter((c) => c._statut === 'actif').length;
  const mrrTotal        = normalized.filter((c) => c._statut === 'actif' && c.montant_mensuel).reduce((s, c) => s + (c.montant_mensuel ?? 0), 0);
  const aRenouvelerCount = normalized.filter(isARenouveler).length;

  const counts: Record<Filter, number> = {
    tous:         normalized.length,
    actif:        normalized.filter((c) => c._statut === 'actif').length,
    expire:       normalized.filter((c) => c._statut === 'expire').length,
    resilie:      normalized.filter((c) => c._statut === 'resilie').length,
    a_renouveler: aRenouvelerCount,
  };

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteContratAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-green-600">{actifs}</p>
          <p className="text-xs text-slate-400">Contrats actifs</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{fmtEur(mrrTotal)}</p>
          <p className="text-xs text-slate-400">MRR total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-center">
          <p className="text-lg font-bold text-slate-500">{counts.expire}</p>
          <p className="text-xs text-slate-400">Expirés</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter('a_renouveler')}
          className={`rounded-xl border shadow-sm p-3 text-center transition-colors ${
            aRenouvelerCount > 0
              ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <p className={`text-lg font-bold ${aRenouvelerCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {aRenouvelerCount}
          </p>
          <p className={`text-xs ${aRenouvelerCount > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
            À renouveler
          </p>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher client, nom, numéro…"
          className="flex-1 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau contrat
        </button>
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap gap-1.5">
        {(['tous', 'actif', 'expire', 'resilie', 'a_renouveler'] as Filter[]).map((f) => {
          const meta   = f !== 'tous' && f !== 'a_renouveler' ? STATUT_META[f as ContratStatut] : null;
          const active = filter === f;
          const isRenew = f === 'a_renouveler';
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? f === 'tous'         ? 'bg-slate-800 text-white'
                  : isRenew              ? 'bg-amber-100 text-amber-700'
                  : `${meta!.bg} ${meta!.text}`
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {f === 'tous' ? 'Tous' : isRenew ? '⚠ À renouveler' : meta!.label}
              <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {factureToast && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-semibold">
          ✓ {factureToast}
        </div>
      )}

      {renewToast && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-semibold">
          ✅ {renewToast}
        </div>
      )}

      {/* Liste */}
      {visible.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400">
            {filter === 'a_renouveler' ? 'Aucun contrat à renouveler.' : `Aucun contrat${filter !== 'tous' ? ' avec ce statut' : ''}.`}
          </p>
          {filter === 'tous' && (
            <button onClick={() => setFormOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              Créer un contrat
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => {
            const statutMeta = STATUT_META[c._statut];
            const daysLeft   = expiresInDays(c);
            const company    = c.company_id ? companyMap.get(c.company_id) : null;
            const mrr        = c.montant_mensuel;

            const lastInv      = lastInvByClient.get(c.client_id);
            const periodDays   = periodeDays(c.frequence ?? null);
            const needsBilling = c._statut === 'actif' && mrr && (
              !lastInv || (Date.now() - new Date(lastInv.date_facture).getTime()) > periodDays * 86_400_000
            );
            const isFacturing  = facturantId === c.id && isPending;
            const needsRenew   = isARenouveler(c);
            const daysExpired  = daysLeft !== null && daysLeft < 0 ? Math.abs(daysLeft) : null;

            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-start gap-3">
                  {/* Dot statut */}
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statutMeta.dot}`} />

                  <div className="min-w-0 flex-1">
                    {/* Ligne 1 : numéro + nom + statut */}
                    <div className="flex flex-wrap items-center gap-2">
                      {c.numero && (
                        <span className="font-mono text-xs font-semibold text-slate-400">{c.numero}</span>
                      )}
                      <p className="font-semibold text-slate-800 truncate">
                        {c.nom ?? TYPE_LABELS[c.type]}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statutMeta.bg} ${statutMeta.text}`}>
                        {statutMeta.label}
                      </span>
                      <Badge variant={TYPE_VARIANT[c.type] ?? 'default'}>{TYPE_LABELS[c.type]}</Badge>
                      {needsBilling && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">À facturer</span>
                      )}
                      {c._statut === 'actif' && daysExpired !== null && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          🔴 Expiré depuis {daysExpired}j
                        </span>
                      )}
                      {c._statut === 'actif' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          ⚠ Expire dans {daysLeft}j
                        </span>
                      )}
                    </div>

                    {/* Ligne 2 : client + société */}
                    <p className="mt-0.5 text-sm text-slate-500">
                      {c.client_nom ?? '—'}
                      {company && <span className="ml-2 text-slate-400">· {company}</span>}
                    </p>

                    {/* Ligne 3 : montant + fréquence + dates */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {mrr && (
                        <span className="font-semibold text-slate-700">
                          {fmtEur(mrr)}{c.frequence ? `/${c.frequence.slice(0, 4).replace('mens', 'mois').replace('trim', 'trim').replace('annu', 'an')}` : '/mois'}
                        </span>
                      )}
                      {c.frequence && <span>{FREQ_LABELS[c.frequence]}</span>}
                      <span>{fmtDate(c.date_debut)}{c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ''}</span>
                      {c.materiel_couvert?.length > 0 && (
                        <span>{c.materiel_couvert.length} équip.</span>
                      )}
                    </div>

                    {/* Ligne 4 : dernière facture */}
                    {lastInv ? (
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>Dernière facture : {lastInv.number} · {fmtDate(lastInv.date_facture)}</span>
                        {(() => {
                          const m = INV_STATUS_META[lastInv.status] ?? INV_STATUS_META.emise;
                          return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.text}`}>{m.label}</span>;
                        })()}
                      </div>
                    ) : c._statut === 'actif' && mrr ? (
                      <p className="mt-1.5 text-xs text-slate-400 italic">Jamais facturé</p>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Bouton Renouveler */}
                    {needsRenew && (
                      <button
                        onClick={() => { setError(''); openRenew(c); }}
                        disabled={isPending}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        title="Renouveler le contrat"
                      >
                        🔄 Renouveler
                      </button>
                    )}
                    {/* Bouton Facturer (contrats actifs avec montant) */}
                    {c._statut === 'actif' && mrr && (
                      <button
                        onClick={() => { setError(''); handleFacturer(c.id); }}
                        disabled={isFacturing || isPending}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        title="Facturer la période"
                      >
                        {isFacturing ? '…' : 'Facturer'}
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(c); setFormOpen(true); }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      title="Modifier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setError(''); setDeleteId(c.id); }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Supprimer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ContratForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        companies={companies}
        projects={projects}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Résilier ce contrat ?"
        description="Cette action est irréversible."
        confirmLabel="Résilier"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!renewId}
        title="Renouveler ce contrat ?"
        description={renewLabel}
        confirmLabel="🔄 Renouveler"
        onConfirm={handleRenew}
        onCancel={() => setRenewId(null)}
        loading={renewing}
      />
    </>
  );
}
