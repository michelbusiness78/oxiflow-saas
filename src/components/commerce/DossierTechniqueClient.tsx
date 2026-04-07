'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getClientTechnicalDossier,
  getDocumentUrlAction,
} from '@/app/actions/documents';
import type { ClientDossierData, InterventionForDossier, DocumentWithContext } from '@/app/actions/documents';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
};

const fmtStatus = (s: string) => {
  const m: Record<string, string> = {
    planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
  };
  return m[s] ?? s;
};

const fmtSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} o` : bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / 1048576).toFixed(1)} Mo`;

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    planifiee: 'bg-blue-100 text-blue-700',
    en_cours:  'bg-amber-100 text-amber-700',
    terminee:  'bg-green-100 text-green-700',
    annulee:   'bg-red-100 text-red-700',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
};

const fileIcon = (ext: string) => {
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return '🖼️';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  return '📎';
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Collapsible({ title, badge, defaultOpen = false, children }: {
  title: string; badge?: string | number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {badge !== undefined && (
            <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-600">{badge}</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={2} stroke="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

function InterventionCard({ iv }: { iv: InterventionForDossier }) {
  const [open, setOpen] = useState(false);
  const dur = iv.timer_elapsed
    ? fmtDuration(iv.timer_elapsed)
    : iv.hour_start && iv.hour_end
    ? fmtDuration(Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000))
    : null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{iv.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {fmtDate(iv.date_start)}{iv.tech_name ? ` · ${iv.tech_name}` : ''}{dur ? ` · ${dur}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls(iv.status)}`}>
            {fmtStatus(iv.status)}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor"
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 space-y-3 text-sm">
          {/* Checklist */}
          {iv.checklist.length > 0 && (
            <div className="pt-2 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Checklist</p>
              {iv.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${item.done ? 'text-green-600' : 'text-red-500'}`}>
                    {item.done ? '✓' : '✗'}
                  </span>
                  <span className={`text-xs ${item.done ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Observations */}
          {iv.observations?.trim() && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs font-semibold text-slate-500 mb-1">Observations</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{iv.observations}</p>
            </div>
          )}

          {/* Matériels */}
          {iv.materials_installed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Matériels installés</p>
              <div className="space-y-1">
                {iv.materials_installed.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-slate-400">•</span>
                    <span className="font-medium">{m.designation ?? '—'}</span>
                    {m.marque && <span className="text-slate-400">{m.marque}{m.modele ? ` ${m.modele}` : ''}</span>}
                    {m.serial && <span className="font-mono text-slate-400">#{m.serial}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {iv.documents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Documents ({iv.documents.length})</p>
              <div className="space-y-1">
                {iv.documents.map((doc) => (
                  <DocDownloadRow key={doc.id} storagePath={doc.storage_path} name={doc.name} size={doc.size} ext={doc.type} />
                ))}
              </div>
            </div>
          )}

          {/* Signature */}
          {iv.signature_name && (
            <p className="text-xs font-semibold text-green-700">
              ✓ Signé par {iv.signature_name}{iv.signature_date ? ` le ${fmtDate(iv.signature_date)}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DocDownloadRow({ storagePath, name, size, ext }: { storagePath: string; name: string; size: number; ext: string; }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getDocumentUrlAction(storagePath);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <span className="text-base shrink-0">{fileIcon(ext)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
        <p className="text-xs text-slate-400">{fmtSize(size)}</p>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {downloading ? '…' : '↓'}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  clientId:   string;
  clientName: string;
  clientAddr: string;
}

export function DossierTechniqueClient({ clientId, clientName, clientAddr }: Props) {
  const [dossier,    setDossier]    = useState<ClientDossierData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState(0);

  // Group documents by intervention
  const docsByIntervention = (docs: DocumentWithContext[]) => {
    const groups = new Map<string, { title: string; date: string; docs: DocumentWithContext[] }>();
    for (const doc of docs) {
      if (!groups.has(doc.intervention_id)) {
        groups.set(doc.intervention_id, {
          title: doc.intervention_title,
          date:  doc.intervention_date,
          docs:  [],
        });
      }
      groups.get(doc.intervention_id)!.docs.push(doc);
    }
    return Array.from(groups.values());
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    getClientTechnicalDossier(clientId)
      .then(setDossier)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleGeneratePDF = useCallback(async () => {
    if (!dossier) return;
    setGenerating(true);
    setProgress(0);
    try {
      const { generateClientDossierPDF } = await import('@/lib/client-dossier-pdf');
      // Fetch company info for logo
      let company = { name: 'OxiFlow', logoUrl: null as string | null };
      try {
        const { getTenantInfoForPdf } = await import('@/app/actions/users-management');
        company = await getTenantInfoForPdf();
      } catch { /* use defaults */ }

      await generateClientDossierPDF(
        dossier,
        clientName,
        clientAddr,
        company,
        (p) => setProgress(p),
      );
    } catch (e) {
      alert('Erreur lors de la génération du PDF : ' + String(e));
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  }, [dossier, clientName, clientAddr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span className="ml-3 text-sm text-slate-500">Chargement du dossier…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Erreur : {error}
      </div>
    );
  }

  if (!dossier) return null;

  const { stats, interventions, materiel, documents, contrats } = dossier;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Interventions',  value: stats.total_interventions,     color: 'text-blue-600'  },
          { label: 'Terminées',      value: stats.terminees,               color: 'text-green-600' },
          { label: 'Matériels',      value: stats.total_materiel,          color: 'text-slate-800' },
          { label: 'Documents',      value: stats.total_documents,         color: 'text-slate-800' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* PDF button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGeneratePDF}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {generating ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Génération… {Math.round(progress * 100)}%
            </>
          ) : (
            <>📥 Générer le dossier complet PDF</>
          )}
        </button>
        {generating && (
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Interventions */}
      <Collapsible title="Interventions" badge={interventions.length} defaultOpen>
        <div className="p-3 space-y-2">
          {interventions.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucune intervention</p>
          ) : (
            interventions.map((iv) => <InterventionCard key={iv.id} iv={iv} />)
          )}
        </div>
      </Collapsible>

      {/* Parc matériel */}
      <Collapsible title="Parc matériel installé" badge={materiel.length}>
        <div className="p-3">
          {materiel.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucun matériel référencé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Désignation', 'Marque / Modèle', 'N° Série', 'Localisation', 'Date', 'Technicien'].map((h) => (
                      <th key={h} className="text-left py-2 pr-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materiel.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">{m.designation ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-500">{[m.marque, m.modele].filter(Boolean).join(' ') || '—'}</td>
                      <td className="py-2 pr-3 font-mono text-slate-400">{m.serial ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-500">{m.location ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(m.intervention_date)}</td>
                      <td className="py-2 text-slate-400">{m.tech_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Collapsible>

      {/* Documents */}
      <Collapsible title="Documents techniques" badge={documents.length}>
        <div className="p-3 space-y-4">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucun document</p>
          ) : (
            docsByIntervention(documents).map((group) => (
              <div key={group.title + group.date}>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">
                  {group.title} <span className="text-slate-400 font-normal">— {fmtDate(group.date)}</span>
                </p>
                <div className="space-y-1.5">
                  {group.docs.map((doc) => (
                    <DocDownloadRow
                      key={doc.id}
                      storagePath={doc.storage_path}
                      name={doc.name}
                      size={doc.size}
                      ext={doc.type}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Collapsible>

      {/* Contrats */}
      <Collapsible title="Contrats" badge={contrats.length}>
        <div className="p-3 space-y-2">
          {contrats.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucun contrat</p>
          ) : (
            contrats.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700 capitalize">{c.type}</p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(c.date_debut)}{c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.montant_mensuel != null && (
                    <span className="text-sm font-semibold text-slate-700">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c.montant_mensuel)}
                      <span className="text-xs text-slate-400 font-normal">/mois</span>
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Collapsible>
    </div>
  );
}
