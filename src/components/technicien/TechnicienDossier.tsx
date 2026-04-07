'use client';

import { useState, useMemo } from 'react';
import type { PlanningIntervention } from '@/app/actions/technicien';
import type { PeriodFilter } from '@/lib/dossier-pdf';
import { PERIOD_LABELS } from '@/lib/dossier-pdf';

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionKey = 'resume' | 'tableau' | 'checklists' | 'materiel' | 'obs' | 'sig' | 'temps';

interface SectionConfig {
  key:       SectionKey;
  icon:      string;
  label:     string;
  defaultOn: boolean;
}

const SECTION_CONFIGS: SectionConfig[] = [
  { key: 'resume',     icon: '📊', label: 'Résumé & KPIs',            defaultOn: true  },
  { key: 'tableau',    icon: '🔧', label: 'Tableau des interventions', defaultOn: true  },
  { key: 'checklists', icon: '✅', label: 'Checklists',                defaultOn: true  },
  { key: 'materiel',   icon: '📦', label: 'Matériel installé',         defaultOn: true  },
  { key: 'obs',        icon: '📝', label: 'Observations',              defaultOn: false },
  { key: 'sig',        icon: '✍️', label: 'Signatures clients',        defaultOn: false },
  { key: 'temps',      icon: '⏱',  label: 'Temps passé',               defaultOn: false },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: "Aujourd'hui"          },
  { value: '7j',    label: '7 derniers jours'     },
  { value: '30j',   label: '30 derniers jours'    },
  { value: 'all',   label: 'Toutes les interventions' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  interventions: PlanningIntervention[];
  currentUser:   { id: string; name: string };
  tenantId:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyPeriod(interventions: PlanningIntervention[], period: PeriodFilter): PlanningIntervention[] {
  if (period === 'all') return interventions;
  const now = Date.now();
  const cutoff =
    period === 'today' ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })()
    : period === '7j'  ? now - 7  * 86_400_000
    :                    now - 30 * 86_400_000;
  return interventions.filter((i) => new Date(i.date_start).getTime() >= cutoff);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TechnicienDossier({ interventions, currentUser }: Props) {
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>('30j');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [sections,     setSections]     = useState<Record<SectionKey, boolean>>(
    Object.fromEntries(SECTION_CONFIGS.map((s) => [s.key, s.defaultOn])) as Record<SectionKey, boolean>,
  );
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  // Clients uniques extraits des interventions
  const clients = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const i of interventions) {
      const name = i.client_name ?? i.clients?.nom;
      if (name && !seen.has(name)) { seen.add(name); list.push(name); }
    }
    return list.sort();
  }, [interventions]);

  // Interventions filtrées
  const filtered = useMemo(() => {
    let result = applyPeriod(interventions, filterPeriod);
    if (filterClient !== 'all') {
      result = result.filter((i) => (i.client_name ?? i.clients?.nom) === filterClient);
    }
    return result;
  }, [interventions, filterPeriod, filterClient]);

  // KPIs
  const kpis = useMemo(() => ({
    total:     filtered.length,
    terminee:  filtered.filter((i) => i.status === 'terminee').length,
    photos:    filtered.reduce((s, i) => s + (i.photos?.length ?? 0), 0),
    materiels: filtered.reduce((s, i) => s + (i.materials_installed?.length ?? 0), 0),
  }), [filtered]);

  function toggleSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGeneratePDF() {
    setGenerating(true);
    setProgress(5);
    setError(null);
    try {
      const [{ generateDossierPDF }, { getTenantInfoForPdf }] = await Promise.all([
        import('@/lib/dossier-pdf'),
        import('@/app/actions/users-management'),
      ]);
      setProgress(15);
      const company = await getTenantInfoForPdf();
      setProgress(20);
      await generateDossierPDF(filtered, currentUser.name, filterPeriod, sections, company, (p) => {
        setProgress(Math.round(20 + p * 78));
      });
      setProgress(100);
    } catch (e) {
      console.error('[DossierPDF]', e);
      setError('Erreur lors de la génération du PDF. Réessayez.');
    } finally {
      setTimeout(() => { setGenerating(false); setProgress(0); }, 1200);
    }
  }

  function handleExportJSON() {
    const data = filtered.map((i) => ({
      id:           i.id,
      titre:        i.title,
      date:         i.date_start,
      statut:       i.status,
      client:       i.client_name ?? i.clients?.nom,
      type:         i.type_intervention,
      observations: i.observations,
      checklist:    i.checklist,
      materiel:     i.materials_installed,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `OxiFlow_DossierTech_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4 p-4 pb-28 max-w-[480px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Dossier Technique
        </p>
        <span className="text-xs text-slate-400">{currentUser.name}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Intv.',  value: kpis.total,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Term.',  value: kpis.terminee,  color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Photo',  value: kpis.photos,    color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Mat.',   value: kpis.materiels, color: 'text-slate-600',  bg: 'bg-slate-50'  },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border border-[#dde3f0] ${k.bg} p-3 text-center`}>
            <p className={`text-2xl font-extrabold ${k.color}`}>{k.value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-[#dde3f0] bg-white p-4 space-y-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtres</p>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Période</label>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as PeriodFilter)}
            className={selectCls}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client / Projet</label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className={selectCls}
            >
              <option value="all">Tous les clients</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Contenu PDF */}
      <div className="rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contenu du PDF</p>
        {SECTION_CONFIGS.map((s) => {
          const on = sections[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSection(s.key)}
              className={[
                'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-left transition-colors min-h-[48px]',
                on
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : 'bg-slate-50 border border-slate-100 text-slate-500',
              ].join(' ')}
            >
              <span className={[
                'flex-none w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0',
                on ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent',
              ].join(' ')}>
                ✓
              </span>
              <span className="text-base leading-none">{s.icon}</span>
              <span className="font-semibold">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barre de progression */}
      {generating && (
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-slate-400">{progress}% — Génération en cours…</p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* Bouton principal */}
      <button
        type="button"
        onClick={handleGeneratePDF}
        disabled={generating || filtered.length === 0}
        className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[52px]"
      >
        {generating ? '⏳ Génération en cours…' : '📥 Générer le dossier PDF'}
      </button>

      {/* Bouton export JSON */}
      <button
        type="button"
        onClick={handleExportJSON}
        disabled={filtered.length === 0}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors min-h-[48px]"
      >
        💾 Exporter sauvegarde JSON
      </button>

      {filtered.length === 0 && !generating && (
        <p className="py-4 text-center text-sm text-slate-400">
          Aucune intervention pour la période sélectionnée
        </p>
      )}
    </div>
  );
}
