'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptInterventionNotification,
  type InterventionNotifData,
} from '@/app/actions/technicien-notifications';

interface Props {
  initialNotifications: InterventionNotifData[];
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function InterventionNotificationBanner({ initialNotifications }: Props) {
  const router                        = useRouter();
  const [notifications, setNotifs]    = useState(initialNotifications);
  const [accepting,     setAccepting] = useState<string | null>(null);
  const [toast,         setToast]     = useState('');

  if (notifications.length === 0) return null;

  async function handleAccept(notifId: string) {
    setAccepting(notifId);
    const res = await acceptInterventionNotification(notifId);
    setAccepting(null);

    if (res.error) {
      setToast(`Erreur : ${res.error}`);
      setTimeout(() => setToast(''), 4000);
      return;
    }

    setNotifs((prev) => prev.filter((n) => n.id !== notifId));
    setToast('✅ Intervention acceptée');
    setTimeout(() => setToast(''), 4000);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border-l-4 border-blue-600 bg-blue-50 p-4">
      {/* Toast */}
      {toast && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">
          {toast}
        </div>
      )}

      {/* Titre */}
      <p className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">
        🔧 Intervention assignée ({notifications.length})
      </p>

      {/* Cards */}
      <div className="space-y-2">
        {notifications.map((n) => {
          const iv = n.interventions;
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
                  {iv?.date_start && (
                    <span>📅 {fmtDate(iv.date_start)}</span>
                  )}
                  {iv?.clients?.nom && (
                    <span>🏢 {iv.clients.nom}</span>
                  )}
                  {iv?.projects?.name && (
                    <span>📋 {iv.projects.name}</span>
                  )}
                </div>
                {n.message && (
                  <p className="mt-1 text-xs text-slate-400">{n.message}</p>
                )}
              </div>

              {/* Bouton accepter */}
              <button
                type="button"
                disabled={accepting === n.id}
                onClick={() => handleAccept(n.id)}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {accepting === n.id ? '…' : '✅ Accepter'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
