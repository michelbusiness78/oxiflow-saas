'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptProjectNotification,
  dismissProjectNotification,
  type ProjectNotifData,
} from '@/app/actions/projects';
import { fmtEur } from '@/lib/format';

interface ProjectNotificationBannerProps {
  initialNotifications: ProjectNotifData[];
}

export function ProjectNotificationBanner({ initialNotifications }: ProjectNotificationBannerProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pending,       setPending]        = useState<string | null>(null);
  const [toast,         setToast]          = useState('');

  if (notifications.length === 0) return null;

  const newProjects   = notifications.filter((n) => n.type !== 'facturation' && n.type !== 'sav_resolu');
  const facturations  = notifications.filter((n) => n.type === 'facturation');
  const savResolus    = notifications.filter((n) => n.type === 'sav_resolu');

  async function handleAccept(id: string) {
    setPending(id);
    const res = await acceptProjectNotification(id);
    setPending(null);
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

  async function handleDismiss(id: string) {
    setPending(id);
    await dismissProjectNotification(id);
    setPending(null);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    router.refresh();
  }

  return (
    <div className="mb-6 space-y-3 w-full">
      {/* Toast */}
      {toast && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white">
          {toast}
        </div>
      )}

      {/* ── Bandeau VERT — Nouveaux projets ─────────────────────────────────── */}
      {newProjects.length > 0 && (
        <div className="w-full rounded-xl border-l-4 border-green-600 bg-green-50 p-[14px_16px]">
          <p className="mb-3 text-sm font-bold text-green-800 uppercase tracking-wide">
            📋 Nouveau projet affecté ({newProjects.length})
          </p>

          <div className="space-y-[10px]">
            {newProjects.map((n) => (
              <div
                key={n.id}
                className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 shadow-sm overflow-hidden"
              >
                {/* Info */}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 leading-snug">{n.project_name}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {n.affair_number && (
                      <span className="mr-2 font-mono text-slate-600">{n.affair_number}</span>
                    )}
                    {n.client_nom}
                  </p>
                  {n.commercial_name !== '—' && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Commercial : {n.commercial_name}</p>
                  )}
                </div>

                {/* Montant */}
                <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {fmtEur(n.amount_ttc)}
                </span>

                {/* Actions — pleine largeur sur mobile */}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <a
                    href="/chef-projet"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:w-auto sm:py-1.5"
                  >
                    Voir →
                  </a>
                  <button
                    type="button"
                    disabled={pending === n.id}
                    onClick={() => handleAccept(n.id)}
                    className="w-full rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors sm:w-auto sm:py-1.5"
                  >
                    {pending === n.id ? '…' : '✓ Accepter'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bandeau BLEU — Tickets SAV résolus ────────────────────────────── */}
      {savResolus.length > 0 && (
        <div className="w-full rounded-xl border-l-4 border-blue-500 bg-blue-50 p-[14px_16px]">
          <p className="mb-3 text-sm font-bold text-blue-800 uppercase tracking-wide">
            🔧 Ticket SAV résolu ({savResolus.length})
          </p>

          <div className="space-y-[10px]">
            {savResolus.map((n) => (
              <div
                key={n.id}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm overflow-hidden"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 leading-snug">{n.title}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{n.client_nom}</p>
                  {n.message && (
                    <p className="mt-1 text-[11px] text-slate-400">{n.message}</p>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <a
                    href="/chef-projet?tab=sav"
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-700 transition-colors sm:w-auto sm:py-1.5"
                  >
                    Voir tickets →
                  </a>
                  <button
                    type="button"
                    disabled={pending === n.id}
                    onClick={() => handleDismiss(n.id)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors sm:w-auto sm:py-1.5"
                  >
                    {pending === n.id ? '…' : 'Ignorer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bandeau ORANGE — Interventions à facturer ───────────────────────── */}
      {facturations.length > 0 && (
        <div className="w-full rounded-xl border-l-4 border-orange-500 bg-orange-50 p-[14px_16px]">
          <p className="mb-3 text-sm font-bold text-orange-800 uppercase tracking-wide">
            🧾 Intervention terminée — À facturer ({facturations.length})
          </p>

          <div className="space-y-[10px]">
            {facturations.map((n) => (
              <div
                key={n.id}
                className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm overflow-hidden"
              >
                {/* Info */}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 leading-snug">{n.title}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {n.affair_number && (
                      <span className="mr-2 font-mono text-slate-600">{n.affair_number}</span>
                    )}
                    {n.client_nom}
                  </p>
                  {n.message && (
                    <p className="mt-1 text-[11px] text-slate-400">{n.message}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <a
                    href={`/commerce?tab=factures`}
                    className="w-full rounded-lg bg-orange-500 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-orange-600 transition-colors sm:w-auto sm:py-1.5"
                  >
                    Facturer →
                  </a>
                  <button
                    type="button"
                    disabled={pending === n.id}
                    onClick={() => handleDismiss(n.id)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors sm:w-auto sm:py-1.5"
                  >
                    {pending === n.id ? '…' : 'Ignorer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
