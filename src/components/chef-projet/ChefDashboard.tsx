'use client';

import { Badge } from '@/components/ui/Badge';
import { fmtDate } from '@/lib/format';

export interface ProjetDash {
  id:             string;
  nom:            string;
  statut:         string;
  date_fin_prevue: string | null;
  pct_avancement: number;
  client_nom:     string;
  updated_at:     string;
}

export interface TacheDash {
  id:            string;
  titre:         string;
  etat:          string;
  priorite:      string;
  date_echeance: string | null;
  projet_nom?:   string;
}

export interface InterventionDash {
  id:     string;
  date:   string;
  statut: string;
}

interface Props {
  projets:       ProjetDash[];
  taches:        TacheDash[];
  interventions: InterventionDash[];
}

export function ChefDashboard({ projets, taches, interventions }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  // Lundi de la semaine courante
  const startOfWeek = new Date(today);
  const day = today.getDay();
  startOfWeek.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const projetsActifs = projets.filter((p) => p.statut === 'en_cours').length;

  const tachesEnRetard = taches.filter(
    (t) => t.etat !== 'terminee' && t.date_echeance && new Date(t.date_echeance) < today,
  );

  const interventionsSemaine = interventions.filter((i) => {
    const d = new Date(i.date);
    return d >= startOfWeek && d <= endOfWeek;
  }).length;

  // ── Alertes ───────────────────────────────────────────────────────────────
  const projetsStales = projets.filter(
    (p) => p.statut === 'en_cours' && new Date(p.updated_at) < sevenDaysAgo,
  );

  const kpis = [
    {
      label: 'Projets actifs',
      value: projetsActifs,
      colorVal: 'text-blue-600',
      colorBg:  'bg-blue-50',
    },
    {
      label: 'Tâches en retard',
      value: tachesEnRetard.length,
      colorVal: tachesEnRetard.length > 0 ? 'text-oxi-danger'  : 'text-oxi-success',
      colorBg:  tachesEnRetard.length > 0 ? 'bg-oxi-danger-light' : 'bg-green-50',
    },
    {
      label: 'Interventions cette semaine',
      value: interventionsSemaine,
      colorVal: 'text-oxi-info',
      colorBg:  'bg-oxi-info-light',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${k.colorBg} mb-3`}>
              <span className={`text-2xl font-bold ${k.colorVal}`}>{k.value}</span>
            </div>
            <p className="text-sm text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {(tachesEnRetard.length > 0 || projetsStales.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">
              Alertes
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-oxi-danger-light text-oxi-danger text-xs font-bold w-5 h-5">
                {tachesEnRetard.length + projetsStales.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {tachesEnRetard.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-oxi-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    Tâche en retard :{' '}
                    <span className="font-medium">{t.titre}</span>
                  </p>
                  {t.projet_nom && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.projet_nom}
                      {t.date_echeance && ` · Échéance ${fmtDate(t.date_echeance)}`}
                    </p>
                  )}
                </div>
                <Badge variant="danger" className="shrink-0">En retard</Badge>
              </div>
            ))}
            {projetsStales.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-oxi-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    Pas de mise à jour depuis 7j :{' '}
                    <span className="font-medium">{p.nom}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.client_nom} · Dernière MAJ {fmtDate(p.updated_at)}
                  </p>
                </div>
                <Badge variant="warning" className="shrink-0">Inactif</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
