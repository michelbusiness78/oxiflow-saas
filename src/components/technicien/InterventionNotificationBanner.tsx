'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  markInterventionNotificationRead,
  type InterventionNotifData,
} from '@/app/actions/technicien-notifications';

interface Props {
  initialNotifications: InterventionNotifData[];
  onOpenDetail:         (interventionId: string) => void;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function InterventionNotificationBanner({ initialNotifications, onOpenDetail }: Props) {
  const router                     = useRouter();
  const [notifications, setNotifs] = useState(initialNotifications);
  const [loading, setLoading]      = useState<string | null>(null);

  if (notifications.length === 0) return null;

  async function handleVoir(notifId: string, interventionId: string) {
    setLoading(notifId);
    await markInterventionNotificationRead(notifId);
    setLoading(null);
    setNotifs((prev) => prev.filter((n) => n.id !== notifId));
    router.refresh();
    onOpenDetail(interventionId);
  }

  return (
    <div className="mb-6 rounded-xl border border-[#2563eb] bg-[#eff6ff] p-4">
      {/* Titre */}
      <p className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">
        🔧 Nouvelle intervention ({notifications.length})
      </p>

      {/* Cards */}
      <div className="space-y-2">
        {notifications.map((n) => {
          const iv = n.interventions;
          const clientLine = [iv?.clients?.nom, iv?.clients?.ville].filter(Boolean).join(' · ');

          return (
            <div
              key={n.id}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 shadow-sm"
            >
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {iv?.title ?? n.title}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {iv?.date_start && <span>📅 {fmtDate(iv.date_start)}</span>}
                  {clientLine     && <span>🏢 {clientLine}</span>}
                  {iv?.projects?.name && <span>📋 {iv.projects.name}</span>}
                </div>
              </div>

              {/* Bouton Voir */}
              <button
                type="button"
                disabled={loading === n.id}
                onClick={() => handleVoir(n.id, n.intervention_id)}
                className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {loading === n.id ? '…' : '👁 Voir'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
