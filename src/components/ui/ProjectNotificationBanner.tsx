'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptProjectNotification,
  type ProjectNotifData,
} from '@/app/actions/projects';
import { fmtEur } from '@/lib/format';

interface ProjectNotificationBannerProps {
  initialNotifications: ProjectNotifData[];
}

export function ProjectNotificationBanner({ initialNotifications }: ProjectNotificationBannerProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [accepting,     setAccepting]     = useState<string | null>(null);
  const [toast,         setToast]         = useState('');

  if (notifications.length === 0) return null;

  async function handleAccept(id: string) {
    setAccepting(id);
    const res = await acceptProjectNotification(id);
    setAccepting(null);
    if (res.error) {
      setToast(`Erreur : ${res.error}`);
      setTimeout(() => setToast(''), 4000);
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setToast('✅ Projet accepté — statut passé en cours');
    setTimeout(() => setToast(''), 4000);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border-l-4 border-green-600 bg-green-50 p-4">
      {/* Toast */}
      {toast && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white">
          {toast}
        </div>
      )}

      {/* Titre */}
      <p className="mb-3 text-sm font-bold text-green-800 uppercase tracking-wide">
        📋 Nouveau projet affecté ({notifications.length})
      </p>

      {/* Cards notifications */}
      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="flex flex-wrap items-start gap-3 rounded-lg border border-green-200 bg-white px-4 py-3 shadow-sm"
          >
            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{n.project_name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {n.affair_number && (
                  <span className="mr-2 font-mono text-slate-600">{n.affair_number}</span>
                )}
                {n.client_nom}
                {n.commercial_name !== '—' && (
                  <span className="ml-2 text-slate-400">· Commercial : {n.commercial_name}</span>
                )}
              </p>
              {n.message && (
                <p className="mt-1 text-xs text-slate-400">{n.message}</p>
              )}
            </div>

            {/* Montant */}
            <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {fmtEur(n.amount_ttc)}
            </span>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-2">
              <a
                href="/projets"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Voir →
              </a>
              <button
                type="button"
                disabled={accepting === n.id}
                onClick={() => handleAccept(n.id)}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {accepting === n.id ? '…' : '✓ Accepter'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
