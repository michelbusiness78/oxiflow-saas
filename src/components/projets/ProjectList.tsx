'use client';

import { useState, useMemo } from 'react';
import { SlideOver }         from '@/components/ui/SlideOver';
import { fmtEur, fmtDate }  from '@/lib/format';
import type { Project, ProjectStatus } from '@/app/actions/projects';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<ProjectStatus, { label: string; cls: string }> = {
  nouveau:   { label: 'Nouveau',    cls: 'bg-amber-100 text-amber-700'   },
  en_cours:  { label: 'En cours',   cls: 'bg-blue-100 text-blue-700'     },
  termine:   { label: 'Terminé',    cls: 'bg-green-100 text-green-700'   },
  annule:    { label: 'Annulé',     cls: 'bg-slate-100 text-slate-500'   },
};

const STATUTS: Array<ProjectStatus | 'tous'> = ['tous', 'nouveau', 'en_cours', 'termine', 'annule'];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskCount { done: number; total: number }

interface ProjectListProps {
  projects:    Project[];
  users:       { id: string; name: string }[];
  taskCounts?: Record<string, TaskCount>;
  detailHref?: (projectId: string) => string;
}

// ─── Panneau détail ───────────────────────────────────────────────────────────

function ProjectDetail({
  project, users, open, onClose,
}: {
  project: Project;
  users:   { id: string; name: string }[];
  open:    boolean;
  onClose: () => void;
}) {
  const chefNom = users.find((u) => u.id === project.chef_projet_user_id)?.name ?? '—';
  const commNom = users.find((u) => u.id === project.commercial_user_id)?.name  ?? '—';
  const meta    = STATUS_META[project.status];

  const rowCls = 'flex items-start justify-between py-2 border-b border-slate-100 text-sm';
  const labelC = 'text-xs font-semibold uppercase tracking-wide text-slate-400 w-36 shrink-0 mt-0.5';
  const valueC = 'text-slate-700 text-right';

  return (
    <SlideOver open={open} onClose={onClose} title={project.name} width="md">
      <div className="px-5 py-4 space-y-1">
        {/* Statut badge */}
        <div className="mb-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
        </div>

        <div className={rowCls}>
          <span className={labelC}>N° Affaire</span>
          <span className={`${valueC} font-mono`}>{project.affair_number ?? '—'}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>N° Devis</span>
          <span className={`${valueC} font-mono`}>{project.quote_number ?? '—'}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Client</span>
          <span className={valueC}>{project.client_nom}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Chef de projet</span>
          <span className={valueC}>{chefNom}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Commercial</span>
          <span className={valueC}>{commNom}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Montant TTC</span>
          <span className={`${valueC} font-semibold text-slate-800`}>{fmtEur(project.amount_ttc)}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Échéance</span>
          <span className={valueC}>{project.deadline ? fmtDate(project.deadline) : '—'}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Type</span>
          <span className={valueC}>{project.type ?? '—'}</span>
        </div>
        <div className={rowCls}>
          <span className={labelC}>Créé le</span>
          <span className={valueC}>{fmtDate(project.created_at)}</span>
        </div>
        {project.description && (
          <div className="pt-2">
            <p className={labelC}>Description</p>
            <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">{project.description}</p>
          </div>
        )}
        {project.notes && (
          <div className="pt-2">
            <p className={labelC}>Notes</p>
            <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">{project.notes}</p>
          </div>
        )}
      </div>
    </SlideOver>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ProjectList({ projects, users, taskCounts, detailHref }: ProjectListProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'tous'>('tous');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Project | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return projects.filter((p) => {
      if (statusFilter !== 'tous' && p.status !== statusFilter) return false;
      if (q && !(
        normalize(p.name).includes(q) ||
        normalize(p.client_nom).includes(q) ||
        normalize(p.affair_number ?? '').includes(q) ||
        normalize(p.quote_number  ?? '').includes(q)
      )) return false;
      return true;
    });
  }, [projects, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Partial<Record<ProjectStatus | 'tous', number>> = { tous: projects.length };
    for (const p of projects) { c[p.status] = (c[p.status] ?? 0) + 1; }
    return c;
  }, [projects]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, client, n° affaire…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Chips statut */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUTS.map((s) => {
          const count  = counts[s] ?? 0;
          const active = statusFilter === s;
          const meta   = s !== 'tous' ? STATUS_META[s as ProjectStatus] : null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? (s === 'tous' ? 'bg-slate-800 text-white' : (meta!.cls + ' ring-2 ring-offset-1'))
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {s === 'tous' ? 'Tous' : meta!.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-xs">{count}</span>
              )}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">{filtered.length} projet{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grille de cartes */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm text-slate-400">
            {search || statusFilter !== 'tous' ? 'Aucun résultat pour ces filtres.' : 'Aucun projet pour l\'instant. Acceptez un devis pour créer votre premier projet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const meta    = STATUS_META[p.status];
            const chefNom = users.find((u) => u.id === p.chef_projet_user_id)?.name;
            const tc      = taskCounts?.[p.id];
            const tcPct   = tc && tc.total > 0 ? Math.round((tc.done / tc.total) * 100) : 0;
            const href    = detailHref?.(p.id);

            const cardContent = (
              <>
                {/* Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800 leading-tight line-clamp-2">{p.name}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>

                {/* Client */}
                <p className="text-sm text-slate-600">{p.client_nom}</p>

                {/* N° affaire */}
                {p.affair_number && (
                  <p className="mt-1 font-mono text-xs text-slate-400">{p.affair_number}</p>
                )}

                {/* Chef de projet */}
                {chefNom && (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="text-slate-400">Chef :</span> {chefNom}
                  </p>
                )}

                {/* Barre de tâches */}
                {tc && tc.total > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Tâches</span>
                      <span className="font-medium">{tc.done}/{tc.total}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${tcPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${tcPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{fmtEur(p.amount_ttc)}</span>
                  <span className="text-xs text-slate-400">{fmtDate(p.created_at)}</span>
                </div>
              </>
            );

            return href ? (
              <a
                key={p.id}
                href={href}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {cardContent}
              </a>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-md transition-all"
              >
                {cardContent}
              </button>
            );
          })}
        </div>
      )}

      {/* Panneau détail */}
      {selected && (
        <ProjectDetail
          project={selected}
          users={users}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
