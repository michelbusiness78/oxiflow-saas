'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reminder {
  id:       string;
  name:     string;
  note:     string | null;
  priority: string;
  due:      string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIO_META: Record<string, { icon: string; border: string; bg: string; text: string }> = {
  urgente: { icon: '🔴', border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-800'    },
  haute:   { icon: '🟠', border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-800' },
  high:    { icon: '🔴', border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-800'    },
  normale: { icon: '🔵', border: 'border-blue-300',   bg: 'bg-blue-50',   text: 'text-blue-800'   },
  mid:     { icon: '🔵', border: 'border-blue-300',   bg: 'bg-blue-50',   text: 'text-blue-800'   },
  basse:   { icon: '⚪', border: 'border-slate-200',  bg: 'bg-slate-50',  text: 'text-slate-700'  },
  low:     { icon: '⚪', border: 'border-slate-200',  bg: 'bg-slate-50',  text: 'text-slate-700'  },
};

// Clé sessionStorage : IDs déjà fermés dans cette session
const SESSION_KEY = 'oxiflow_reminders_dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
  } catch { /* silently ignore */ }
}

// Lien vers l'onglet "Mes tâches" selon la page courante
function taskLink(pathname: string): string {
  if (pathname.startsWith('/commerce'))    return '/commerce?tab=taches';
  if (pathname.startsWith('/chef-projet')) return '/chef-projet?tab=taches';
  if (pathname.startsWith('/rh'))          return '/rh?tab=taches';
  if (pathname.startsWith('/technicien'))  return '/technicien';
  return '/pilotage/dashboard';
}

// ── Composant ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function ReminderBanner() {
  const pathname  = usePathname();
  const [visible, setVisible]  = useState<Reminder[]>([]);
  const dismissed = useRef<Set<string>>(new Set());

  const fetchDue = useCallback(async () => {
    try {
      const res  = await fetch('/api/reminders/due');
      if (!res.ok) return;
      const data = await res.json() as { reminders: Reminder[] };
      const dis  = getDismissed();

      // Filtrer : seulement les non-encore-fermés dans cette session
      const fresh = data.reminders.filter((r) => !dis.has(r.id));
      if (fresh.length > 0) {
        setVisible((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes     = fresh.filter((r) => !existingIds.has(r.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
    } catch { /* silently ignore network errors */ }
  }, []);

  // Fetch immédiat au montage + polling toutes les 5 min
  useEffect(() => {
    dismissed.current = getDismissed();
    fetchDue();
    const timer = setInterval(fetchDue, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchDue]);

  function dismiss(id: string) {
    setVisible((prev) => prev.filter((r) => r.id !== id));
    const dis = getDismissed();
    dis.add(id);
    saveDismissed(dis);
  }

  function dismissAll() {
    const dis = getDismissed();
    visible.forEach((r) => dis.add(r.id));
    saveDismissed(dis);
    setVisible([]);
  }

  if (visible.length === 0) return null;

  const link = taskLink(pathname);

  return (
    <div className="mb-4 space-y-2 w-full animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Titre groupé si plusieurs rappels */}
      {visible.length > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            📌 {visible.length} rappels
          </span>
          <button
            onClick={dismissAll}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Tout fermer
          </button>
        </div>
      )}

      {visible.map((reminder) => {
        const meta  = PRIO_META[reminder.priority] ?? PRIO_META.normale;
        const dueFr = reminder.due
          ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
              new Date(reminder.due + 'T12:00:00'),
            )
          : null;

        return (
          <div
            key={reminder.id}
            className={[
              'flex items-start gap-3 rounded-xl border-l-4 px-4 py-3 shadow-sm',
              meta.border, meta.bg,
            ].join(' ')}
          >
            {/* Icône */}
            <span className="mt-0.5 text-base shrink-0">{meta.icon}</span>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${meta.text} truncate`}>
                📌 Rappel : {reminder.name}
              </div>
              {reminder.note && (
                <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                  {reminder.note}
                </div>
              )}
              {dueFr && (
                <div className="mt-0.5 text-xs text-slate-400">
                  Échéance : {dueFr}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={link}
                className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Voir →
              </a>
              <button
                onClick={() => dismiss(reminder.id)}
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
