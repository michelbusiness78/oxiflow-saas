'use client';

import { useState } from 'react';

export interface TechnicienWithStats {
  id:                  string;
  name:                string;
  color:               string | null;
  email:               string | null;
  interventionsActives: number;
  projetsAssignes:      string[];  // project names
}

interface Props {
  techniciens: TechnicienWithStats[];
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9'];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function disponibilite(count: number): { label: string; cls: string; dot: string } {
  if (count === 0) return { label: 'Disponible',    cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  };
  if (count <= 2)  return { label: 'En mission',    cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'  };
  return             { label: 'Chargé',           cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    };
}

export function TechniciensTab({ techniciens }: Props) {
  const [selected, setSelected] = useState<TechnicienWithStats | null>(null);

  if (techniciens.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
        Aucun technicien dans l'équipe
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-800">
        Équipe techniciens
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {techniciens.length}
        </span>
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {techniciens.map((t, i) => {
          const color = t.color ?? COLORS[i % COLORS.length];
          const dispo  = disponibilite(t.interventionsActives);

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t === selected ? null : t)}
              className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials(t.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                  {t.email && <p className="text-xs text-slate-400 truncate">{t.email}</p>}
                </div>
              </div>

              {/* Disponibilité */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${dispo.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dispo.dot}`} />
                  {dispo.label}
                </span>
                {t.interventionsActives > 0 && (
                  <span className="text-xs text-slate-500">
                    {t.interventionsActives} intervention{t.interventionsActives > 1 ? 's' : ''} en cours
                  </span>
                )}
              </div>

              {/* Projets assignés */}
              {t.projetsAssignes.length > 0 && (
                <div className="mt-3 space-y-1">
                  {t.projetsAssignes.slice(0, 3).map((nom, idx) => (
                    <p key={idx} className="text-xs text-slate-500 truncate">
                      <span className="mr-1 text-blue-400">•</span>{nom}
                    </p>
                  ))}
                  {t.projetsAssignes.length > 3 && (
                    <p className="text-xs text-slate-400 italic">
                      +{t.projetsAssignes.length - 3} projet{t.projetsAssignes.length - 3 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
