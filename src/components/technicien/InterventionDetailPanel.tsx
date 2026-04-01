'use client';

import { useState, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { updateInterventionStatus } from '@/app/actions/technicien-notifications';
import type { PlanningIntervention } from '@/app/actions/technicien-notifications';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  planifiee: { label: 'Planifiée',  cls: 'bg-blue-100  text-blue-700'   },
  en_cours:  { label: 'En cours',   cls: 'bg-orange-100 text-orange-700' },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100 text-green-700'  },
  annulee:   { label: 'Annulée',    cls: 'bg-slate-100 text-slate-400'  },
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}

interface Props {
  intervention:    PlanningIntervention | null;
  onClose:         () => void;
  onStatusChange:  (id: string, newStatus: string) => void;
}

export function InterventionDetailPanel({ intervention, onClose, onStatusChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]            = useState('');

  if (!intervention) return null;

  const cfg = STATUS_LABELS[intervention.status] ?? { label: intervention.status, cls: 'bg-slate-100 text-slate-500' };

  const clientAddr = [
    intervention.clients?.adresse,
    intervention.clients?.cp,
    intervention.clients?.ville,
  ].filter(Boolean).join(', ');

  function handleStatus(newStatus: 'planifiee' | 'en_cours' | 'terminee') {
    setError('');
    startTransition(async () => {
      const res = await updateInterventionStatus(intervention!.id, newStatus);
      if (res.error) { setError(res.error); return; }
      onStatusChange(intervention!.id, newStatus);
    });
  }

  return (
    <SlideOver
      open={!!intervention}
      onClose={onClose}
      title="Détail intervention"
      width="lg"
    >
      <div className="flex flex-col gap-5 p-5 pb-28">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Titre + badge */}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold text-slate-800">{intervention.title}</h3>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Dates */}
        <div className="rounded-xl border border-[#dde3f0] bg-slate-50 p-4 space-y-3">
          <InfoRow
            icon="📅"
            label="Début"
            value={fmtDateTime(intervention.date_start)}
          />
          {intervention.date_end && (
            <InfoRow
              icon="🏁"
              label="Fin prévue"
              value={fmtDateTime(intervention.date_end)}
            />
          )}
        </div>

        {/* Client */}
        {intervention.clients && (
          <div className="rounded-xl border border-[#dde3f0] bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Client</p>
            <div className="space-y-2">
              <InfoRow icon="🏢" label="Nom"     value={intervention.clients.nom} />
              {clientAddr && (
                <InfoRow icon="📍" label="Adresse" value={clientAddr} />
              )}
              {intervention.clients.tel && (
                <InfoRow icon="📞" label="Tél."    value={intervention.clients.tel} />
              )}
            </div>
          </div>
        )}

        {/* Projet */}
        {intervention.projects && (
          <div className="rounded-xl border border-[#dde3f0] bg-slate-50 p-4 space-y-2">
            <InfoRow
              icon="📋"
              label="Projet"
              value={[
                intervention.projects.name,
                intervention.projects.affair_number,
              ].filter(Boolean).join(' — ')}
            />
          </div>
        )}

        {/* Notes */}
        {intervention.notes && (
          <div className="rounded-xl border border-[#dde3f0] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{intervention.notes}</p>
          </div>
        )}
      </div>

      {/* Boutons fixes en bas */}
      <div className="fixed bottom-0 right-0 w-full max-w-lg border-t border-slate-200 bg-white px-5 py-4 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Fermer
        </button>

        {intervention.status === 'planifiee' && (
          <button
            type="button"
            onClick={() => handleStatus('en_cours')}
            disabled={isPending}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isPending ? '…' : '🚀 Démarrer'}
          </button>
        )}

        {intervention.status === 'en_cours' && (
          <button
            type="button"
            onClick={() => handleStatus('terminee')}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '…' : '✅ Terminer'}
          </button>
        )}
      </div>
    </SlideOver>
  );
}
