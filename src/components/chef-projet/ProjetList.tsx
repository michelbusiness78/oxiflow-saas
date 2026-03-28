'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { fmtDate } from '@/lib/format';

export interface ProjetCard {
  id:              string;
  nom:             string;
  statut:          string;
  date_debut:      string | null;
  date_fin_prevue: string | null;
  pct_avancement:  number;
  montant_ht:      number | null;
  client_id:       string;
  client_nom:      string;
  updated_at:      string;
}

interface Client { id: string; nom: string; }

interface Props {
  projets: ProjetCard[];
  clients: Client[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Urgency = 'success' | 'warning' | 'danger' | 'muted';

function projetUrgency(p: ProjetCard): Urgency {
  if (p.statut !== 'en_cours') return 'muted';
  if (!p.date_fin_prevue)      return 'muted';
  const diffDays = Math.ceil(
    (new Date(p.date_fin_prevue).getTime() - Date.now()) / 86_400_000,
  );
  if (diffDays < 0)  return 'danger';
  if (diffDays <= 7) return 'warning';
  return 'success';
}

function statutConfig(s: string) {
  const map: Record<string, { label: string; variant: 'muted' | 'info' | 'success' | 'danger' }> = {
    en_attente: { label: 'En attente', variant: 'muted'    },
    en_cours:   { label: 'En cours',   variant: 'info'     },
    termine:    { label: 'Terminé',    variant: 'success'  },
    annule:     { label: 'Annulé',     variant: 'danger'   },
  };
  return map[s] ?? { label: s, variant: 'muted' as const };
}

const STATUTS = ['tous', 'en_attente', 'en_cours', 'termine', 'annule'] as const;

const BORDER_COLOR: Record<Urgency, string> = {
  success: 'border-l-oxi-success',
  warning: 'border-l-oxi-warning',
  danger:  'border-l-oxi-danger',
  muted:   'border-l-oxi-border',
};

const BAR_COLOR: Record<Urgency, string> = {
  success: 'bg-oxi-success',
  warning: 'bg-oxi-warning',
  danger:  'bg-oxi-danger',
  muted:   'bg-oxi-primary',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjetList({ projets, clients }: Props) {
  const [statutFilter, setStatutFilter] = useState('tous');
  const [clientFilter, setClientFilter] = useState('tous');

  const filtered = projets
    .filter((p) => statutFilter === 'tous' || p.statut === statutFilter)
    .filter((p) => clientFilter === 'tous' || p.client_id === clientFilter);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statutFilter === s
                  ? 'bg-oxi-primary text-white'
                  : 'bg-oxi-bg text-oxi-text-secondary hover:bg-oxi-border',
              ].join(' ')}
            >
              {s === 'tous' ? 'Tous' : statutConfig(s).label}
            </button>
          ))}
        </div>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-oxi-border bg-oxi-surface px-3 py-1.5 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-oxi-primary"
        >
          <option value="tous">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-oxi-text-muted">
          {filtered.length} projet{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-oxi-border py-14 text-center text-sm text-oxi-text-muted">
          Aucun projet{statutFilter !== 'tous' || clientFilter !== 'tous' ? ' avec ces filtres' : ' assigné'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const urgency = projetUrgency(p);
            const statut  = statutConfig(p.statut);
            return (
              <Link
                key={p.id}
                href={`/chef-projet?projet=${p.id}`}
                className={[
                  'group flex flex-col rounded-xl border bg-oxi-surface p-5',
                  'border-l-4 transition-shadow hover:shadow-md',
                  BORDER_COLOR[urgency],
                ].join(' ')}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-oxi-text truncate group-hover:text-oxi-primary transition-colors">
                      {p.nom}
                    </p>
                    <p className="text-xs text-oxi-text-muted mt-0.5">{p.client_nom}</p>
                  </div>
                  <Badge variant={statut.variant} className="shrink-0">{statut.label}</Badge>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-oxi-text-muted mb-1.5">
                    <span>Avancement</span>
                    <span className="font-medium">{p.pct_avancement}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-oxi-border overflow-hidden">
                    <div
                      className={['h-full rounded-full transition-all', BAR_COLOR[urgency]].join(' ')}
                      style={{ width: `${p.pct_avancement}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between text-xs text-oxi-text-muted">
                  {p.date_fin_prevue ? (
                    <span>
                      Fin :{' '}
                      <span
                        className={
                          urgency === 'danger'
                            ? 'text-oxi-danger font-medium'
                            : urgency === 'warning'
                            ? 'text-oxi-warning font-medium'
                            : ''
                        }
                      >
                        {fmtDate(p.date_fin_prevue)}
                      </span>
                    </span>
                  ) : (
                    <span>Pas de date de fin</span>
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4 opacity-30 group-hover:opacity-80 group-hover:text-oxi-primary transition-all"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
