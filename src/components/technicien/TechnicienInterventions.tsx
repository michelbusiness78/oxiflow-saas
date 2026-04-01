'use client';

import type { PlanningIntervention } from '@/app/actions/technicien';

interface Props {
  interventions: PlanningIntervention[];
  onSelect:      (i: PlanningIntervention) => void;
}

// ── Groupement ────────────────────────────────────────────────────────────────

interface Grouped {
  today:    PlanningIntervention[];
  tomorrow: PlanningIntervention[];
  week:     PlanningIntervention[];
  later:    PlanningIntervention[];
  past:     PlanningIntervention[];
}

function groupByDay(items: PlanningIntervention[]): Grouped {
  const now      = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const weekEnd  = new Date(now); weekEnd.setDate(now.getDate() + 7);

  const g: Grouped = { today: [], tomorrow: [], week: [], later: [], past: [] };
  for (const i of items) {
    const d = new Date(i.date_start); d.setHours(0, 0, 0, 0);
    if      (d < now)                              g.past.push(i);
    else if (d.getTime() === now.getTime())        g.today.push(i);
    else if (d.getTime() === tomorrow.getTime())   g.tomorrow.push(i);
    else if (d < weekEnd)                          g.week.push(i);
    else                                           g.later.push(i);
  }
  return g;
}

// ── Formatage ─────────────────────────────────────────────────────────────────

function fmtDay(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long',
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// ── Statut ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; bar: string }> = {
  planifiee: { label: 'Planifiée',  cls: 'bg-blue-100   text-[#2563eb]', bar: '#2563eb' },
  en_cours:  { label: 'En cours',   cls: 'bg-orange-100 text-[#d97706]', bar: '#d97706' },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-[#16a34a]', bar: '#16a34a' },
  annulee:   { label: 'Annulée',    cls: 'bg-slate-100  text-slate-400', bar: '#cbd5e1' },
};

// ── Carte ─────────────────────────────────────────────────────────────────────

function InterventionCard({ item, onSelect }: { item: PlanningIntervention; onSelect: (i: PlanningIntervention) => void }) {
  const cfg       = STATUS_CFG[item.status] ?? { label: item.status, cls: 'bg-slate-100 text-slate-500', bar: '#94a3b8' };
  const timeRange = item.date_end
    ? `${fmtTime(item.date_start)} – ${fmtTime(item.date_end)}`
    : fmtTime(item.date_start);
  const clientNom  = item.client_name  ?? item.clients?.nom  ?? null;
  const clientCity = item.client_city  ?? item.clients?.ville ?? null;
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
      <div className="w-1 shrink-0" style={{ backgroundColor: cfg.bar }} />
      <div className="flex-1 p-4 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-800">{item.title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        <p className="text-xs text-slate-500">
          📅 {fmtDay(item.date_start)} · {timeRange}
          {item.hours_planned != null && (
            <span className="ml-2 text-slate-400">· {item.hours_planned}h prévues</span>
          )}
        </p>

        {clientNom && (
          <p className="text-xs text-slate-500">
            🏢 {[clientNom, clientCity].filter(Boolean).join(' · ')}
          </p>
        )}

        {item.projects?.name && (
          <p className="text-xs text-slate-400">📋 {item.projects.name}</p>
        )}

        {checkTotal > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.round((checkDone / checkTotal) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{checkDone}/{checkTotal}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section groupe ────────────────────────────────────────────────────────────

function GroupSection({
  label, items, onSelect,
}: {
  label: string; items: PlanningIntervention[]; onSelect: (i: PlanningIntervention) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label} · {items.length}
      </p>
      {items.map((i) => (
        <InterventionCard key={i.id} item={i} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function TechnicienInterventions({ interventions, onSelect }: Props) {
  if (interventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-4xl mb-3">🔧</p>
        <p className="text-sm font-semibold text-slate-600">Aucune intervention</p>
        <p className="mt-1 text-xs text-slate-400">Vos interventions apparaîtront ici</p>
      </div>
    );
  }

  const g = groupByDay(interventions);

  return (
    <div className="space-y-6 p-4">
      <p className="text-base font-bold text-slate-800 uppercase tracking-wide">
        Mes interventions
      </p>
      <GroupSection label="Aujourd'hui"   items={g.today}    onSelect={onSelect} />
      <GroupSection label="Demain"        items={g.tomorrow} onSelect={onSelect} />
      <GroupSection label="Cette semaine" items={g.week}     onSelect={onSelect} />
      <GroupSection label="Plus tard"     items={g.later}    onSelect={onSelect} />
      <GroupSection label="Passées"       items={g.past}     onSelect={onSelect} />
    </div>
  );
}
