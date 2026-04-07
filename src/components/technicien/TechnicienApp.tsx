'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TechnicienAccueil }       from './TechnicienAccueil';
import { TechnicienInterventions } from './TechnicienInterventions';
import { TechnicienDossier }       from './TechnicienDossier';
import { TechnicienMateriel }      from './TechnicienMateriel';
import { InterventionDetailPanel } from './InterventionDetailPanel';
import { MesTaches }               from '@/components/shared/MesTaches';
import type { PlanningIntervention } from '@/app/actions/technicien';
import type { PersonalTask }         from '@/app/actions/tasks';

type Tab = 'accueil' | 'interventions' | 'taches' | 'materiel' | 'dossier' | 'historique';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'accueil',       icon: '🏠', label: 'Accueil'       },
  { id: 'interventions', icon: '🔧', label: 'Interventions' },
  { id: 'taches',        icon: '📌', label: 'Mes tâches'    },
  { id: 'materiel',      icon: '📦', label: 'Matériel'      },
  { id: 'dossier',       icon: '📁', label: 'Dossier'       },
  { id: 'historique',    icon: '📜', label: 'Historique'    },
];

interface Props {
  currentUser:          { id: string; name: string };
  tenantId:             string;
  initialInterventions: PlanningIntervention[];
  initialTasks:         PersonalTask[];
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso));
}

export function TechnicienApp({ currentUser, tenantId, initialInterventions, initialTasks }: Props) {
  const router = useRouter();
  const [activeTab,     setActiveTab]     = useState<Tab>('accueil');
  const [interventions, setInterventions] = useState<PlanningIntervention[]>(initialInterventions);
  const [selected,      setSelected]      = useState<PlanningIntervention | null>(null);

  // KPIs calculés localement (se mettent à jour quand le statut change)
  const kpis = useMemo(() => {
    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      todayCount:   interventions.filter((i) => { const d = new Date(i.date_start); return d >= todayStart && d <= todayEnd; }).length,
      plannedCount: interventions.filter((i) => i.status === 'planifiee' && new Date(i.date_start) >= todayStart).length,
      monthDone:    interventions.filter((i) => {
        const d = new Date(i.date_start);
        return i.status === 'terminee' && d >= monthStart && d <= monthEnd;
      }).length,
    };
  }, [interventions]);

  const newInterventions = useMemo(
    () => interventions.filter((i) => i.is_new),
    [interventions],
  );

  function handleMarkRead(interventionId: string) {
    setInterventions((prev) =>
      prev.map((i) => (i.id === interventionId ? { ...i, is_new: false } : i)),
    );
    router.refresh();
  }

  function handleStatusChange(interventionId: string, newStatus: string) {
    setInterventions((prev) =>
      prev.map((i) => (i.id === interventionId ? { ...i, status: newStatus } : i)),
    );
    setSelected((prev) =>
      prev?.id === interventionId ? { ...prev, status: newStatus } : prev,
    );
    router.refresh();
  }

  function handleSaveProgress(interventionId: string, updates: Partial<PlanningIntervention>) {
    setInterventions((prev) =>
      prev.map((i) => (i.id === interventionId ? { ...i, ...updates } : i)),
    );
    setSelected((prev) =>
      prev?.id === interventionId ? { ...prev, ...updates } : prev,
    );
  }

  // ── Contenu de l'onglet actif ────────────────────────────────────────────────

  function renderContent() {
    switch (activeTab) {
      case 'accueil':
        return (
          <TechnicienAccueil
            currentUser={currentUser}
            kpis={kpis}
            interventions={interventions}
            newInterventions={newInterventions}
            onSelect={setSelected}
            onMarkRead={handleMarkRead}
          />
        );

      case 'interventions':
        return (
          <TechnicienInterventions
            interventions={interventions}
            onSelect={setSelected}
          />
        );

      case 'taches':
        return (
          <div className="p-4">
            <MesTaches
              initialTasks={initialTasks}
              tenantId={tenantId}
              userId={currentUser.id}
            />
          </div>
        );

      case 'materiel':
        return (
          <TechnicienMateriel
            tenantId={tenantId}
            currentUserId={currentUser.id}
          />
        );

      case 'dossier':
        return (
          <TechnicienDossier
            interventions={interventions}
            currentUser={currentUser}
            tenantId={tenantId}
          />
        );

      case 'historique': {
        const done = [...interventions]
          .filter((i) => i.status === 'terminee')
          .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
        return (
          <div className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Interventions terminées · {done.length}
            </p>
            {done.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">Aucune intervention terminée</p>
              </div>
            ) : done.map((i) => (
              <div
                key={i.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(i)}
                className="rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800">{i.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {fmtDate(i.date_start)}
                  {(i.client_name ?? i.clients?.nom) && ` · ${i.client_name ?? i.clients?.nom}`}
                </p>
              </div>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <div className="relative">
      {/* ── Desktop : onglets horizontaux ─────────────────────────────────── */}
      <div className="hidden md:flex gap-1 border-b border-[#dde3f0] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'relative px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id === 'accueil' && newInterventions.length > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {newInterventions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
      {renderContent()}

      {/* ── Panel détail (global, tous onglets) ───────────────────────────── */}
      <InterventionDetailPanel
        intervention={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        onSaveProgress={handleSaveProgress}
      />

      {/* ── Mobile : bottom nav ────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t border-slate-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors',
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {activeTab === tab.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-blue-600" />
            )}
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
              {tab.label}
            </span>
            {tab.id === 'accueil' && newInterventions.length > 0 && (
              <span className="absolute top-1.5 right-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {newInterventions.length}
              </span>
            )}
            {tab.id === 'taches' && initialTasks.filter((t) => !t.done).length > 0 && (
              <span className="absolute top-1.5 right-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                {initialTasks.filter((t) => !t.done).length}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
