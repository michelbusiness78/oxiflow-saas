'use client';

import type { PlanningIntervention } from '@/app/actions/technicien-notifications';

interface Props {
  interventions: PlanningIntervention[];
}

// ── Groupement par jour ────────────────────────────────────────────────────────

type Group = 'today' | 'tomorrow' | 'week' | 'later';

interface Grouped {
  today:    PlanningIntervention[];
  tomorrow: PlanningIntervention[];
  week:     PlanningIntervention[];
  later:    PlanningIntervention[];
}

function groupByDay(items: PlanningIntervention[]): Grouped {
  const now      = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const weekEnd  = new Date(now); weekEnd.setDate(now.getDate() + 7);

  const g: Grouped = { today: [], tomorrow: [], week: [], later: [] };
  for (const i of items) {
    const d = new Date(i.date_start); d.setHours(0, 0, 0, 0);
    if      (d.getTime() === now.getTime())      g.today.push(i);
    else if (d.getTime() === tomorrow.getTime()) g.tomorrow.push(i);
    else if (d < weekEnd)                        g.week.push(i);
    else                                         g.later.push(i);
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
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// ── Badge statut ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  planifiee:  { label: 'Planifiée',   cls: 'bg-blue-100  text-blue-700'  },
  confirmee:  { label: 'Confirmée',   cls: 'bg-green-100 text-green-700' },
  en_cours:   { label: 'En cours',    cls: 'bg-orange-100 text-orange-700' },
  terminee:   { label: 'Terminée',    cls: 'bg-slate-100 text-slate-500'  },
  annulee:    { label: 'Annulée',     cls: 'bg-slate-100 text-slate-400'  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Carte intervention ─────────────────────────────────────────────────────────

function InterventionCard({ item }: { item: PlanningIntervention }) {
  const timeRange = item.date_end
    ? `${fmtTime(item.date_start)} - ${fmtTime(item.date_end)}`
    : fmtTime(item.date_start);

  const clientLine = [
    item.clients?.nom,
    item.clients?.ville,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex items-start gap-4 rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm">
      {/* Barre couleur gauche selon statut */}
      <div
        className="mt-0.5 h-full w-1 shrink-0 rounded-full"
        style={{
          backgroundColor:
            item.status === 'confirmee' ? '#16a34a' :
            item.status === 'en_cours'  ? '#ea580c' :
            item.status === 'terminee'  ? '#94a3b8' :
            item.status === 'annulee'   ? '#cbd5e1' :
            '#2563eb',
          minHeight: 48,
        }}
      />

      <div className="min-w-0 flex-1 space-y-1">
        {/* Titre + badge */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{item.title}</p>
          <StatusBadge status={item.status} />
        </div>

        {/* Date + heure */}
        <p className="text-xs text-slate-500">
          📅 {fmtDay(item.date_start)} · {timeRange}
        </p>

        {/* Client */}
        {clientLine && (
          <p className="text-xs text-slate-500">🏢 {clientLine}</p>
        )}

        {/* Projet */}
        {item.projects?.name && (
          <p className="text-xs text-slate-400">📋 {item.projects.name}</p>
        )}

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-slate-400 italic">"{item.notes}"</p>
        )}
      </div>
    </div>
  );
}

// ── Section groupe ────────────────────────────────────────────────────────────

function GroupSection({
  label,
  items,
}: {
  label: string;
  items: PlanningIntervention[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {items.map((i) => (
        <InterventionCard key={i.id} item={i} />
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function TechnicienPlanning({ interventions }: Props) {
  if (interventions.length === 0) {
    return (
      <div className="rounded-xl border border-[#dde3f0] bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-slate-400">Aucune intervention à venir.</p>
      </div>
    );
  }

  const g = groupByDay(interventions);

  return (
    <div className="space-y-6">
      <GroupSection label="Aujourd'hui"   items={g.today}    />
      <GroupSection label="Demain"        items={g.tomorrow} />
      <GroupSection label="Cette semaine" items={g.week}     />
      <GroupSection label="Plus tard"     items={g.later}    />
    </div>
  );
}
