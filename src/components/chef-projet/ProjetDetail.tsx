'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { TacheList } from '@/components/projets/TacheList';
import { fmtDate } from '@/lib/format';
import { assignerTechnicienProjetAction } from '@/app/actions/chef-projet';
import type { Tache } from '@/components/projets/TacheForm';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjetFull {
  id:              string;
  nom:             string;
  statut:          string;
  date_debut:      string | null;
  date_fin_prevue: string | null;
  pct_avancement:  number;
  montant_ht:      number | null;
  client_id:       string;
  client_nom:      string;
  chef_nom:        string;
  updated_at:      string;
}

export interface TacheWithMeta extends Tache {
  projet_nom?:  string;
  assigne_nom?: string;
}

export interface InterventionRow {
  id:              string;
  date:            string;
  type:            string;
  statut:          string;
  duree_minutes:   number | null;
  technicien_nom:  string;
}

export interface UserForList {
  id:     string;
  nom:    string;
  prenom: string;
}

export interface TechnicienMin {
  id:   string;
  name: string;
}

interface Props {
  projet:        ProjetFull;
  taches:        TacheWithMeta[];
  interventions: InterventionRow[];
  users:         UserForList[];
  techniciens:   TechnicienMin[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statutConfig(s: string) {
  const map: Record<string, { label: string; variant: 'muted' | 'info' | 'success' | 'danger' }> = {
    en_attente: { label: 'En attente', variant: 'muted'   },
    en_cours:   { label: 'En cours',   variant: 'info'    },
    termine:    { label: 'Terminé',    variant: 'success' },
    annule:     { label: 'Annulé',     variant: 'danger'  },
  };
  return map[s] ?? { label: s, variant: 'muted' as const };
}

const INTERVENTION_LABELS: Record<string, string> = {
  installation: 'Installation',
  maintenance:  'Maintenance',
  depannage:    'Dépannage',
  formation:    'Formation',
  audit:        'Audit',
};

function interventionStatutVariant(s: string): 'success' | 'info' | 'muted' {
  if (s === 'terminee') return 'success';
  if (s === 'en_cours') return 'info';
  return 'muted';
}

function interventionStatutLabel(s: string) {
  const map: Record<string, string> = {
    planifiee: 'Planifiée',
    en_cours:  'En cours',
    terminee:  'Terminée',
    annulee:   'Annulée',
  };
  return map[s] ?? s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjetDetail({ projet, taches, interventions, users, techniciens }: Props) {
  const [assignOpen,    setAssignOpen]    = useState(false);
  const [selectedTech,  setSelectedTech]  = useState('');
  const [assignError,   setAssignError]   = useState('');
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [isPending,     startTransition]  = useTransition();

  const statut = statutConfig(projet.statut);

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(projet.updated_at).getTime()) / 86_400_000,
  );

  // Timeline : tâches avec date, triées par échéance
  const timelineTaches = taches
    .filter((t) => t.date_echeance)
    .sort((a, b) => (a.date_echeance! < b.date_echeance! ? -1 : 1));

  function handleAssigner() {
    if (!selectedTech) return;
    setAssignError('');
    startTransition(async () => {
      const res = await assignerTechnicienProjetAction(projet.id, selectedTech);
      if ('error' in res && res.error) {
        setAssignError(res.error);
      } else {
        setAssignSuccess(true);
        setAssignOpen(false);
        setSelectedTech('');
        setTimeout(() => setAssignSuccess(false), 3000);
      }
    });
  }

  // TacheList attend un tableau { id, nom } pour les dossiers
  const dossierForList = [{ id: projet.id, nom: projet.nom }];

  return (
    <div className="space-y-6">
      {/* Retour */}
      <Link
        href="/chef-projet"
        className="inline-flex items-center gap-1.5 text-sm text-oxi-text-secondary hover:text-oxi-primary transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Retour aux projets
      </Link>

      {/* En-tête projet */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-oxi-text">{projet.nom}</h1>
          <p className="mt-0.5 text-sm text-oxi-text-secondary">{projet.client_nom}</p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={statut.variant}>{statut.label}</Badge>

          {/* Bouton assigner technicien */}
          <div className="relative">
            <button
              onClick={() => setAssignOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-oxi-border bg-oxi-surface px-4 py-2 text-sm font-medium text-oxi-text hover:bg-oxi-bg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
              Assigner un technicien
            </button>

            {assignOpen && (
              <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-xl border border-oxi-border bg-oxi-surface shadow-lg p-4 space-y-3">
                <p className="text-xs font-medium text-oxi-text">
                  Assigner aux tâches sans assigné
                </p>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-oxi-primary"
                >
                  <option value="">Choisir un technicien…</option>
                  {techniciens.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {assignError && (
                  <p className="text-xs text-oxi-danger">{assignError}</p>
                )}
                {techniciens.length === 0 && (
                  <p className="text-xs text-oxi-text-muted">Aucun technicien disponible</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAssigner}
                    disabled={!selectedTech || isPending}
                    className="flex-1 rounded-lg bg-oxi-primary px-3 py-2 text-xs font-semibold text-white hover:bg-oxi-primary-hover disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'En cours…' : 'Assigner'}
                  </button>
                  <button
                    onClick={() => { setAssignOpen(false); setAssignError(''); }}
                    className="rounded-lg border border-oxi-border px-3 py-2 text-xs text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {assignSuccess && (
        <div className="rounded-lg bg-oxi-success-light px-4 py-3 text-sm text-oxi-success">
          Technicien assigné aux tâches sans assigné.
        </div>
      )}

      {/* Résumé 4 cases */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Chef de projet', value: projet.chef_nom },
          {
            label: 'Date début',
            value: projet.date_debut ? fmtDate(projet.date_debut) : '—',
          },
          {
            label: 'Date fin prévue',
            value: projet.date_fin_prevue ? fmtDate(projet.date_fin_prevue) : '—',
          },
          {
            label: 'Dernière mise à jour',
            value:
              daysSinceUpdate === 0
                ? "Aujourd'hui"
                : daysSinceUpdate === 1
                ? 'Hier'
                : `Il y a ${daysSinceUpdate} j`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-oxi-border bg-oxi-surface px-4 py-3">
            <p className="text-xs text-oxi-text-muted">{s.label}</p>
            <p className="mt-0.5 text-sm font-medium text-oxi-text truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Avancement global */}
      <div className="rounded-xl border border-oxi-border bg-oxi-surface p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-oxi-text">Avancement global</p>
          <span className="text-2xl font-bold text-oxi-primary">{projet.pct_avancement}%</span>
        </div>
        <div className="h-3 rounded-full bg-oxi-border overflow-hidden">
          <div
            className="h-full rounded-full bg-oxi-primary transition-all"
            style={{ width: `${projet.pct_avancement}%` }}
          />
        </div>
      </div>

      {/* Tâches + Planning côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tâches */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-oxi-text">Tâches</h2>
          {taches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-oxi-border py-10 text-center text-sm text-oxi-text-muted">
              Aucune tâche pour ce projet
            </div>
          ) : (
            <TacheList
              taches={taches}
              dossiers={dossierForList}
              users={users}
            />
          )}
        </div>

        {/* Planning (timeline verticale) */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-oxi-text">Planning</h2>
          {timelineTaches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-oxi-border py-10 text-center text-sm text-oxi-text-muted">
              Aucune tâche avec date
            </div>
          ) : (
            <div className="relative">
              {/* Ligne verticale */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-oxi-border" />
              <div className="space-y-3">
                {timelineTaches.map((t) => {
                  const isLate = t.etat !== 'terminee' && new Date(t.date_echeance!) < new Date();
                  const isDone = t.etat === 'terminee';
                  return (
                    <div key={t.id} className="relative flex gap-4 pl-8">
                      {/* Dot */}
                      <div
                        className={[
                          'absolute left-1.5 top-2 h-3.5 w-3.5 rounded-full border-2 border-oxi-bg',
                          isDone  ? 'bg-oxi-success'  :
                          isLate  ? 'bg-oxi-danger'   :
                                    'bg-oxi-primary',
                        ].join(' ')}
                      />
                      <div className="flex-1 rounded-lg border border-oxi-border bg-oxi-surface p-3">
                        <p className="text-xs font-medium text-oxi-text leading-snug">{t.titre}</p>
                        <p className={['text-xs mt-0.5', isLate ? 'text-oxi-danger font-medium' : 'text-oxi-text-muted'].join(' ')}>
                          {fmtDate(t.date_echeance!)}
                          {isLate && ' · En retard'}
                        </p>
                        {t.assigne_nom && (
                          <p className="text-xs text-oxi-text-muted mt-1">{t.assigne_nom}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interventions liées */}
      {interventions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-oxi-text">
            Interventions liées
            <span className="ml-2 text-sm font-normal text-oxi-text-muted">({interventions.length})</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-oxi-border bg-oxi-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oxi-border bg-oxi-bg text-left text-xs text-oxi-text-muted">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Technicien</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Durée</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-oxi-border">
                {interventions.map((i) => (
                  <tr key={i.id} className="hover:bg-oxi-bg transition-colors">
                    <td className="px-4 py-3 text-oxi-text">{fmtDate(i.date)}</td>
                    <td className="px-4 py-3 text-oxi-text-secondary">
                      {INTERVENTION_LABELS[i.type] ?? i.type}
                    </td>
                    <td className="px-4 py-3 text-oxi-text-secondary hidden sm:table-cell">
                      {i.technicien_nom}
                    </td>
                    <td className="px-4 py-3 text-oxi-text-muted hidden md:table-cell">
                      {i.duree_minutes ? `${i.duree_minutes} min` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={interventionStatutVariant(i.statut)}>
                        {interventionStatutLabel(i.statut)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
