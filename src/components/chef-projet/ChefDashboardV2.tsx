'use client';

import { useState, useTransition } from 'react';
import { fmtDate, fmtEur } from '@/lib/format';
import { getOverdueProjectTasks } from '@/app/actions/chef-projet';
import type { DashboardData, OverdueTaskItem } from '@/app/actions/chef-projet';

const STATUS_LABELS: Record<string, string> = {
  nouveau:   'Nouveau',
  en_cours:  'En cours',
  termine:   'Terminé',
  annule:    'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  nouveau:  'bg-blue-100 text-blue-700',
  en_cours: 'bg-orange-100 text-orange-700',
  termine:  'bg-green-100 text-green-700',
  annule:   'bg-slate-100 text-slate-500',
};

const PRIORITY_LABEL: Record<string, string> = { high: 'Haute', mid: 'Normale', low: 'Basse' };
const PRIORITY_CLS:   Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  mid:  'bg-amber-100 text-amber-700',
  low:  'bg-green-100 text-green-700',
};

interface Props {
  data: DashboardData;
}

export function ChefDashboardV2({ data }: Props) {
  const [showOverdue,    setShowOverdue]    = useState(false);
  const [overdueTasks,   setOverdueTasks]   = useState<OverdueTaskItem[]>([]);
  const [isPending,      startTransition]   = useTransition();

  function handleTasksKpiClick() {
    if (data.tachesEnRetard === 0) return;
    if (showOverdue) { setShowOverdue(false); return; }
    startTransition(async () => {
      const tasks = await getOverdueProjectTasks();
      setOverdueTasks(tasks);
      setShowOverdue(true);
    });
  }

  const kpis = [
    {
      label:    'Projets en cours',
      value:    data.projetsEnCours,
      colorVal: 'text-blue-600',
      colorBg:  'bg-blue-50',
      icon:     '🏗️',
      onClick:  undefined as (() => void) | undefined,
    },
    {
      label:    "Interventions aujourd'hui",
      value:    data.interventionsToday,
      colorVal: 'text-orange-600',
      colorBg:  'bg-orange-50',
      icon:     '🔧',
      onClick:  undefined as (() => void) | undefined,
    },
    {
      label:    'Tâches en retard',
      value:    data.tachesEnRetard,
      colorVal: data.tachesEnRetard > 0 ? 'text-red-600'   : 'text-green-600',
      colorBg:  data.tachesEnRetard > 0 ? 'bg-red-50'      : 'bg-green-50',
      icon:     '⚠️',
      onClick:  handleTasksKpiClick,
    },
    {
      label:    'Techniciens actifs',
      value:    data.techsActifs,
      colorVal: 'text-purple-600',
      colorBg:  'bg-purple-50',
      icon:     '👷',
      onClick:  undefined as (() => void) | undefined,
    },
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            onClick={k.onClick}
            className={[
              'rounded-xl border border-slate-200 bg-white shadow-sm p-5 transition-all',
              k.onClick && k.value > 0 ? 'cursor-pointer hover:border-red-300 hover:shadow-md' : '',
              showOverdue && k.label === 'Tâches en retard' ? 'border-red-300 ring-2 ring-red-200' : '',
            ].join(' ')}
          >
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${k.colorBg} mb-3`}>
              <span className={`text-2xl font-bold ${k.colorVal}`}>{isPending && k.label === 'Tâches en retard' ? '…' : k.value}</span>
            </div>
            <p className="text-xs text-slate-500 leading-tight">{k.label}</p>
            {k.onClick && k.value > 0 && (
              <p className="text-xs text-red-500 mt-1 font-medium">Cliquer pour voir →</p>
            )}
          </div>
        ))}
      </div>

      {/* Liste tâches en retard (dépliable) */}
      {showOverdue && (
        <div className="rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-red-700">
              ⚠ Tâches en retard
              <span className="ml-2 rounded-full bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5">
                {overdueTasks.length}
              </span>
            </h3>
            <button
              onClick={() => setShowOverdue(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
          {overdueTasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500 italic">
              Aucune tâche project_tasks en retard (les tâches du module legacy peuvent être comptées).
            </p>
          ) : (
            <div className="divide-y divide-red-100">
              {overdueTasks.map((t) => {
                const isLate = t.due < today;
                return (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.project_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${isLate ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                        {fmtDate(t.due)}{isLate && ' · Retard'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLS[t.priority] ?? PRIORITY_CLS.mid}`}>
                        {PRIORITY_LABEL[t.priority] ?? 'Normale'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Équipe aujourd'hui */}
      {data.equipeAujourdhui.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">
              Équipe aujourd'hui
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5">
                {data.equipeAujourdhui.length} tech
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-3 p-4">
            {data.equipeAujourdhui.map((tech) => (
              <div
                key={tech.userId}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  {tech.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{tech.name}</p>
                  <p className="text-xs text-slate-400">
                    {tech.count} intervention{tech.count > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chantiers en cours */}
      {data.chantiersEnCours.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">
              Chantiers en cours
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5">
                {data.chantiersEnCours.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.chantiersEnCours.map((p) => (
              <div key={p.id} className="px-5 py-3 space-y-2">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.clientNom}
                      {p.deadline && ` · Échéance ${fmtDate(p.deadline)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {fmtEur(p.amount_ttc)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                </div>

                {/* Mini barre tâches */}
                {p.tasksTotal > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#dde3f0] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${p.tasksDone === p.tasksTotal ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.round((p.tasksDone / p.tasksTotal) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {p.tasksDone}/{p.tasksTotal}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.chantiersEnCours.length === 0 && data.equipeAujourdhui.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-400">Aucun chantier en cours pour le moment.</p>
        </div>
      )}
    </div>
  );
}
