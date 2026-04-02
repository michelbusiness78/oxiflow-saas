'use client';

import { useState, useTransition } from 'react';
import { useRouter }               from 'next/navigation';
import {
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
  updateTaskReminder,
  clearTaskReminder,
} from '@/app/actions/project-tasks';
import type { ProjectTask } from '@/app/actions/project-tasks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  mid:  'bg-amber-400',
  low:  'bg-green-500',
};

function fmtDue(due: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(due + 'T12:00:00'));
}

function isLate(due: string) {
  return new Date(due + 'T23:59:59') < new Date();
}

// ── ReminderRow ───────────────────────────────────────────────────────────────

function ReminderRow({ task, onUpdate }: { task: ProjectTask; onUpdate: (t: ProjectTask) => void }) {
  const [open,          setOpen]          = useState(false);
  const [date,          setDate]          = useState(task.reminder_date  ?? '');
  const [time,          setTime]          = useState(task.reminder_time  ?? '09:00');
  const [email,         setEmail]         = useState(task.reminder_email ?? '');
  const [isPending,     startTransition]  = useTransition();

  function handleSave() {
    if (!date || !email) return;
    startTransition(async () => {
      await updateTaskReminder(task.id, date, time, email);
      onUpdate({ ...task, reminder_date: date, reminder_time: time, reminder_email: email, reminder_active: true });
      setOpen(false);
    });
  }

  function handleClear() {
    startTransition(async () => {
      await clearTaskReminder(task.id);
      onUpdate({ ...task, reminder_date: null, reminder_time: null, reminder_email: null, reminder_active: false });
      setOpen(false);
    });
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs font-medium transition-colors px-2 py-0.5 rounded-full ${
          task.reminder_active
            ? 'bg-green-100 text-green-700'
            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
        }`}
      >
        {task.reminder_active ? '🔔' : '+ rappel'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!date || !email || isPending}
              className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              ✓ Sauvegarder
            </button>
            {task.reminder_active && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onDelete,
  onReminderUpdate,
}: {
  task:             ProjectTask;
  onToggle:         (id: string) => void;
  onDelete:         (id: string) => void;
  onReminderUpdate: (t: ProjectTask) => void;
}) {
  const late = !task.done && task.due ? isLate(task.due) : false;

  return (
    <div className={`rounded-lg border bg-white p-3 transition-colors ${
      task.done ? 'border-green-200 bg-green-50/30' : late ? 'border-red-200' : 'border-[#dde3f0]'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            task.done
              ? 'border-green-500 bg-green-500 text-white'
              : late
              ? 'border-red-500 hover:border-red-600'
              : 'border-slate-300 hover:border-blue-500'
          }`}
          aria-label={task.done ? 'Décocher' : 'Cocher'}
        >
          {task.done && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
              <path d="M10.22 3.22a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L4.75 7.69l4.47-4.47a.75.75 0 0 1 1.06 0Z" />
            </svg>
          )}
        </button>

        {/* Priorité */}
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.mid}`}
        />

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${
            task.done ? 'line-through text-[#9aa3be]' : 'text-slate-800'
          }`}>
            {task.name}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {task.due && (
              <span className={`text-xs font-medium ${
                task.done ? 'text-slate-400' : late ? 'text-red-500' : 'text-slate-400'
              }`}>
                {fmtDue(task.due)}{late && !task.done && ' · En retard'}
              </span>
            )}
            <ReminderRow task={task} onUpdate={onReminderUpdate} />
          </div>
        </div>

        {/* Supprimer */}
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors ml-1"
          aria-label="Supprimer la tâche"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialTasks: ProjectTask[];
  projectId:    string;
  tenantId:     string;
}

// ── ProjectTasksSection ───────────────────────────────────────────────────────

export function ProjectTasksSection({ initialTasks, projectId, tenantId }: Props) {
  const router               = useRouter();
  const [tasks,    setTasks] = useState<ProjectTask[]>(initialTasks);
  const [newName,  setNewName] = useState('');
  const [newDue,   setNewDue]  = useState('');
  const [isAdding, startAdd]   = useTransition();
  const [,         startToggle] = useTransition();

  const done  = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleToggle(id: string) {
    // Mise à jour locale immédiate (pas de clignotement)
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    // Sauvegarde serveur + invalidation du cache router (pour le KPI dashboard)
    startToggle(async () => {
      await toggleProjectTask(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteProjectTask(id);
  }

  function handleReminderUpdate(updated: ProjectTask) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    startAdd(async () => {
      const res = await addProjectTask(projectId, tenantId, name, newDue || undefined);
      if (!res.error && res.id) {
        const now = new Date().toISOString();
        setTasks((prev) => [
          ...prev,
          {
            id: res.id!, project_id: projectId, name, done: false,
            due: newDue || null, priority: 'mid', sort_order: prev.length,
            reminder_time: null, reminder_date: null,
            reminder_email: null, reminder_active: false,
            created_at: now,
          },
        ]);
        setNewName('');
        setNewDue('');
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* En-tête progression */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-500">
            Tâches — {done}/{total}
            {total > 0 && (
              <span className="ml-1 text-slate-400">({pct}%)</span>
            )}
          </span>
          {total > 0 && pct === 100 && (
            <span className="text-xs font-semibold text-green-600">✓ Terminé</span>
          )}
        </div>
        {total > 0 && (
          <div className="h-2 rounded-full bg-[#dde3f0] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">
            Aucune tâche. Ajoutez-en ci-dessous.
          </p>
        )}
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onReminderUpdate={handleReminderUpdate}
          />
        ))}
      </div>

      {/* Ajout — 2 lignes sur mobile, 1 ligne sur desktop */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Ligne 1 : input texte pleine largeur */}
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nouvelle tâche..."
          className="w-full rounded-lg border border-[#dde3f0] bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 sm:w-auto sm:flex-1"
        />
        {/* Ligne 2 : date + bouton "+" */}
        <div className="flex w-full gap-2 sm:w-auto sm:contents">
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#dde3f0] bg-white px-2 py-2 text-sm text-slate-600 focus:border-blue-500 focus:outline-none sm:flex-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newName.trim() || isAdding}
            className="h-11 w-11 shrink-0 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors sm:h-auto sm:w-auto sm:px-3 sm:py-2"
          >
            {isAdding ? '…' : '+'}
          </button>
        </div>
      </div>
    </div>
  );
}
