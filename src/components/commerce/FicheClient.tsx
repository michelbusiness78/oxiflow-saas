'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { fmtEur, fmtDate } from '@/lib/format';

import type { RelanceEntry } from '@/app/actions/invoices';

interface Client  { id: string; nom: string; email: string; tel: string; adresse: string; cp: string; ville: string; }
interface Dossier { id: string; nom: string; statut: string; pct_avancement: number; montant_ht: number | null; date_fin_prevue: string | null; }
interface Devis   { id: string; num: string; statut: string; montant_ttc: number; date: string; }
interface Facture { id: string; num: string; statut: string; montant_ttc: number; date: string; echeance: string; }
interface Contrat { id: string; type: string; montant_mensuel: number | null; actif: boolean; date_debut: string; date_fin: string | null; }
interface SAV     { id: string; titre: string | null; priorite: string; statut: string; date_ouverture: string; }
interface RelanceHistorique {
  invoice_id:    string;
  number:        string;
  montant_ttc:   number;
  date_echeance: string;
  relance_n1:    RelanceEntry | null;
  relance_n2:    RelanceEntry | null;
  relance_n3:    RelanceEntry | null;
}

interface FicheClientProps {
  clients:            Client[];
  dossiers:           (Dossier & { client_id: string })[];
  devis:              (Devis   & { client_id: string })[];
  factures:           (Facture & { client_id: string })[];
  contrats:           (Contrat & { client_id: string })[];
  savs:               (SAV     & { client_id: string })[];
  relances?:          (RelanceHistorique & { client_id: string })[];
  initialSelectedId?: string;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-600">{count}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && count === 0 && (
        <p className="px-4 pb-4 text-sm text-slate-400">Aucun élément</p>
      )}
      {open && count > 0 && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FicheClient({ clients, dossiers, devis, factures, contrats, savs, relances = [], initialSelectedId }: FicheClientProps) {
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId ?? '');

  const client    = clients.find((c) => c.id === selectedId);
  const cDossiers = dossiers.filter((d)  => d.client_id === selectedId);
  const cDevis    = devis.filter((d)     => d.client_id === selectedId);
  const cFactures = factures.filter((f)  => f.client_id === selectedId);
  const cContrats = contrats.filter((c)  => c.client_id === selectedId);
  const cSAVs     = savs.filter((s)     => s.client_id === selectedId);
  const cRelances = relances.filter((r)  => r.client_id === selectedId);
  const hasN3     = cRelances.some((r)   => r.relance_n3 !== null);

  function dossierVariant(s: string): 'muted' | 'info' | 'success' | 'danger' {
    const map: Record<string, 'muted' | 'info' | 'success' | 'danger'> = {
      en_attente: 'muted', en_cours: 'info', termine: 'success', annule: 'danger',
    };
    return map[s] ?? 'muted';
  }

  function devisVariant(s: string): 'muted' | 'info' | 'success' | 'danger' | 'warning' {
    const map: Record<string, 'muted' | 'info' | 'success' | 'danger' | 'warning'> = {
      brouillon: 'muted', envoye: 'info', accepte: 'success', refuse: 'danger', expire: 'warning',
    };
    return map[s] ?? 'muted';
  }

  function factureVariant(s: string): 'muted' | 'info' | 'success' | 'danger' | 'warning' {
    const map: Record<string, 'muted' | 'info' | 'success' | 'danger' | 'warning'> = {
      brouillon: 'muted', envoyee: 'info', payee: 'success', impayee: 'danger', partielle: 'warning',
    };
    return map[s] ?? 'muted';
  }

  function savVariant(p: string): 'muted' | 'info' | 'warning' | 'danger' {
    const map: Record<string, 'muted' | 'info' | 'warning' | 'danger'> = {
      faible: 'muted', normale: 'info', haute: 'warning', urgente: 'danger',
    };
    return map[p] ?? 'muted';
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur client */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        {client && (
          <div className="text-sm text-slate-500">
            <span>{client.email}</span>
            {client.tel && <span className="ml-3">{client.tel}</span>}
          </div>
        )}
      </div>

      {!selectedId && (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">Sélectionnez un client pour afficher sa fiche complète</p>
        </div>
      )}

      {client && (
        <>
          {/* En-tête client */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{client.nom}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {[client.adresse, client.cp, client.ville].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="text-right text-sm text-slate-400 space-y-0.5">
                {client.email && <p>{client.email}</p>}
                {client.tel   && <p>{client.tel}</p>}
              </div>
            </div>

            {/* Synthèse chiffres */}
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: 'Dossiers', value: String(cDossiers.length), color: 'text-blue-600' },
                { label: 'Devis',    value: String(cDevis.length),    color: 'text-slate-800'    },
                { label: 'Factures', value: String(cFactures.length), color: 'text-slate-800'    },
                { label: 'Contrats', value: String(cContrats.length), color: 'text-oxi-success' },
                { label: 'Tickets',  value: String(cSAVs.length),     color: cSAVs.some((s) => s.statut === 'ouvert') ? 'text-oxi-danger' : 'text-slate-800' },
                { label: 'Relances', value: String(cRelances.length), color: cRelances.length > 0 ? 'text-amber-600' : 'text-slate-800' },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-white p-2 text-center">
                  <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-slate-400">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dossiers */}
          <Section title="Dossiers & Projets" count={cDossiers.length}>
            <div className="space-y-2">
              {cDossiers.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{d.nom}</p>
                    {d.montant_ht && <p className="text-xs text-slate-400">{fmtEur(d.montant_ht)}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${d.pct_avancement}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{d.pct_avancement}%</span>
                    </div>
                    <Badge variant={dossierVariant(d.statut)}>
                      {d.statut === 'en_attente' ? 'En attente' : d.statut === 'en_cours' ? 'En cours' : d.statut === 'termine' ? 'Terminé' : 'Annulé'}
                    </Badge>
                    {d.date_fin_prevue && <span className="text-xs text-slate-400 hidden md:block">{fmtDate(d.date_fin_prevue)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Devis */}
          <Section title="Devis" count={cDevis.length}>
            <div className="space-y-2">
              {cDevis.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{d.num}</p>
                    <p className="text-xs text-slate-400">{fmtDate(d.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-slate-800">{fmtEur(d.montant_ttc)}</span>
                    <Badge variant={devisVariant(d.statut)}>
                      {d.statut.charAt(0).toUpperCase() + d.statut.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Factures */}
          <Section title="Factures" count={cFactures.length}>
            <div className="space-y-2">
              {cFactures.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{f.num}</p>
                    <p className="text-xs text-slate-400">Échéance : {fmtDate(f.echeance)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold text-sm ${f.montant_ttc < 0 ? 'text-oxi-danger' : 'text-slate-800'}`}>
                      {fmtEur(f.montant_ttc)}
                    </span>
                    <Badge variant={factureVariant(f.statut)}>
                      {f.statut === 'envoyee' ? 'Envoyée' : f.statut === 'payee' ? 'Payée' : f.statut === 'impayee' ? 'Impayée' : f.statut === 'partielle' ? 'Partielle' : 'Brouillon'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Relances */}
          {cRelances.length > 0 && (
            <>
              {hasN3 && (
                <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <span className="text-lg">🔴</span>
                  <p className="text-sm font-semibold text-red-800">
                    Ce client a des factures en 3e niveau de relance — situation critique.
                  </p>
                </div>
              )}
              <Section title="Historique relances" count={cRelances.length}>
                <div className="space-y-3">
                  {cRelances.map((r) => (
                    <div key={r.invoice_id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-slate-700">{r.number}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">{fmtEur(r.montant_ttc)}</span>
                          <span className="text-xs text-slate-400">éch. {fmtDate(r.date_echeance)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {([1, 2, 3] as const).map((n) => {
                          const entry = n === 1 ? r.relance_n1 : n === 2 ? r.relance_n2 : r.relance_n3;
                          if (!entry) return null;
                          const cls = n === 1
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : n === 2
                            ? 'bg-orange-50 border-orange-200 text-orange-800'
                            : 'bg-red-50 border-red-200 text-red-800';
                          return (
                            <div key={n} className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs ${cls}`}>
                              <span className="font-bold">N{n}</span>
                              <span>{fmtDate(entry.date)}</span>
                              <span className="flex-1 truncate text-slate-500">→ {entry.email}</span>
                              <span className="text-slate-400">{entry.sent_by}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          {/* Contrats */}
          <Section title="Contrats" count={cContrats.length}>
            <div className="space-y-2">
              {cContrats.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 capitalize">{c.type}</p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(c.date_debut)}{c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.montant_mensuel && (
                      <span className="text-sm font-semibold text-slate-800">{fmtEur(c.montant_mensuel)}<span className="text-xs text-slate-400">/mois</span></span>
                    )}
                    <Badge variant={c.actif ? 'success' : 'muted'}>{c.actif ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Tickets SAV */}
          <Section title="Tickets SAV" count={cSAVs.length}>
            <div className="space-y-2">
              {cSAVs.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{s.titre ?? '(Sans titre)'}</p>
                    <p className="text-xs text-slate-400">{fmtDate(s.date_ouverture)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={savVariant(s.priorite)}>
                      {s.priorite.charAt(0).toUpperCase() + s.priorite.slice(1)}
                    </Badge>
                    <Badge variant={s.statut === 'resolu' || s.statut === 'cloture' ? 'success' : s.statut === 'en_cours' ? 'warning' : 'danger'}>
                      {s.statut === 'ouvert' ? 'Ouvert' : s.statut === 'en_cours' ? 'En cours' : s.statut === 'resolu' ? 'Résolu' : 'Clôturé'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
