'use client';

import { useState } from 'react';
import { markInterventionRead } from '@/app/actions/technicien';
import type { PlanningIntervention } from '@/app/actions/technicien';

interface KpiData { todayCount: number; plannedCount: number; monthDone: number; }

interface Props {
  currentUser:      { id: string; name: string };
  kpis:             KpiData;
  interventions:    PlanningIntervention[];
  newInterventions: PlanningIntervention[];
  onSelect:         (i: PlanningIntervention) => void;
  onMarkRead:       (interventionId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function fmtDateFR(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  planifiee: { label: 'Planifiée',  cls: 'bg-blue-100   text-[#2563eb]' },
  en_cours:  { label: 'En cours',   cls: 'bg-orange-100 text-[#d97706]' },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-[#16a34a]' },
  annulee:   { label: 'Annulée',    cls: 'bg-slate-100  text-slate-400' },
};

const STATUS_BAR: Record<string, string> = {
  planifiee: '#2563eb',
  en_cours:  '#d97706',
  terminee:  '#16a34a',
  annulee:   '#cbd5e1',
};

// ── Carte intervention ─────────────────────────────────────────────────────────

function InterventionCard({ item, onSelect }: { item: PlanningIntervention; onSelect: (i: PlanningIntervention) => void }) {
  const cfg = STATUS_CFG[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-500' };
  const timeRange = item.date_end
    ? `${fmtTime(item.date_start)} – ${fmtTime(item.date_end)}`
    : fmtTime(item.date_start);

  const clientNom  = item.client_name  ?? item.clients?.nom  ?? null;
  const clientTel  = item.client_phone ?? item.clients?.tel  ?? null;
  const checkDone  = item.checklist.filter((c) => c.done).length;
  const checkTotal = item.checklist.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(item)}
      className="flex items-stretch rounded-xl border border-[#dde3f0] bg-white shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
    >
      {/* Barre gauche statut */}
      <div className="w-1 shrink-0" style={{ backgroundColor: STATUS_BAR[item.status] ?? '#2563eb' }} />

      <div className="flex-1 p-4 space-y-1.5">
        {/* Titre + badge */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-800">{item.title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
          {item.is_new && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
              NEW
            </span>
          )}
        </div>

        {/* Heure + heures prévues */}
        <p className="text-xs text-slate-500">
          🕐 {timeRange}
          {item.hours_planned != null && (
            <span className="ml-2 text-slate-400">· {item.hours_planned}h prévues</span>
          )}
        </p>

        {/* Client */}
        {clientNom && (
          <p className="text-xs text-slate-500">🏢 {clientNom}</p>
        )}

        {/* Checklist + Appeler */}
        <div className="flex items-center justify-between pt-0.5">
          {checkTotal > 0 ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((checkDone / checkTotal) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{checkDone}/{checkTotal}</span>
            </div>
          ) : <span />}

          {clientTel && (
            <a
              href={`tel:${clientTel}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              📞 Appeler
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bandeau notifications ─────────────────────────────────────────────────────

function NewInterventionsBanner({
  items,
  onView,
}: {
  items:  PlanningIntervention[];
  onView: (i: PlanningIntervention) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function handleVoir(item: PlanningIntervention) {
    setLoading(item.id);
    await markInterventionRead(item.id);
    setLoading(null);
    onView(item);
  }

  return (
    <div className="mb-5 rounded-xl border border-[#2563eb] bg-[#eff6ff] p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">
        🔧 Nouvelle intervention ({items.length})
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const clientNom = item.client_name ?? item.clients?.nom;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>📅 {fmtTime(item.date_start)}</span>
                  {clientNom && <span>🏢 {clientNom}</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={loading === item.id}
                onClick={() => handleVoir(item)}
                className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {loading === item.id ? '…' : '👁 Voir'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function TechnicienAccueil({
  currentUser,
  kpis,
  interventions,
  newInterventions,
  onSelect,
  onMarkRead,
}: Props) {
  const firstName  = currentUser.name.split(' ')[0];
  const todayItems = interventions.filter((i) => isToday(i.date_start));

  function handleView(item: PlanningIntervention) {
    onMarkRead(item.id);
    onSelect(item);
  }

  return (
    <div className="space-y-5 p-4">
      {/* Bandeau nouvelles interventions */}
      <NewInterventionsBanner items={newInterventions} onView={handleView} />

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Bonjour {firstName} ! 👋</h1>
        <p className="mt-0.5 text-sm text-slate-400 capitalize">
          {fmtDateFR(new Date())}
        </p>
      </div>

      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-[#2563eb]">{kpis.todayCount}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#5a6382]">Aujourd'hui</p>
        </div>
        <div className="rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-[#16a34a]">{kpis.plannedCount}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#5a6382]">Planifiées</p>
        </div>
        <div className="rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-[#d97706]">{kpis.monthDone}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#5a6382]">Terminées</p>
        </div>
      </div>

      {/* Interventions du jour */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Interventions du jour · {todayItems.length}
        </p>

        {todayItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#dde3f0] py-12 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-slate-400">Aucune intervention aujourd'hui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayItems.map((i) => (
              <InterventionCard key={i.id} item={i} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
