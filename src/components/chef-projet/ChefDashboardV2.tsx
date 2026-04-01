'use client';

import { fmtDate, fmtEur } from '@/lib/format';
import type { DashboardData } from '@/app/actions/chef-projet';

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

interface Props {
  data: DashboardData;
}

export function ChefDashboardV2({ data }: Props) {
  const kpis = [
    {
      label:    'Projets en cours',
      value:    data.projetsEnCours,
      colorVal: 'text-blue-600',
      colorBg:  'bg-blue-50',
      icon:     '🏗️',
    },
    {
      label:    "Interventions aujourd'hui",
      value:    data.interventionsToday,
      colorVal: 'text-orange-600',
      colorBg:  'bg-orange-50',
      icon:     '🔧',
    },
    {
      label:    'Tâches en retard',
      value:    data.tachesEnRetard,
      colorVal: data.tachesEnRetard > 0 ? 'text-red-600'   : 'text-green-600',
      colorBg:  data.tachesEnRetard > 0 ? 'bg-red-50'      : 'bg-green-50',
      icon:     '⚠️',
    },
    {
      label:    'Techniciens actifs',
      value:    data.techsActifs,
      colorVal: 'text-purple-600',
      colorBg:  'bg-purple-50',
      icon:     '👷',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${k.colorBg} mb-3`}>
              <span className={`text-2xl font-bold ${k.colorVal}`}>{k.value}</span>
            </div>
            <p className="text-xs text-slate-500 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

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
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
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
