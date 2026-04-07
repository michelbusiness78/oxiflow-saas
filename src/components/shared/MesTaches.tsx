'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  createPersonalTask,
  updatePersonalTask,
  togglePersonalTask,
  deletePersonalTask,
  type PersonalTask,
  type TaskPriority,
} from '@/app/actions/tasks';

// ── Constantes ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgente: 0, haute: 1, normale: 2, basse: 3,
};

const PRIORITY_META: Record<TaskPriority, { icon: string; label: string; badge: string }> = {
  urgente: { icon: '🔴', label: 'Urgente', badge: 'bg-red-100 text-red-700'    },
  haute:   { icon: '🟠', label: 'Haute',   badge: 'bg-orange-100 text-orange-700' },
  normale: { icon: '🔵', label: 'Normale', badge: 'bg-blue-100 text-blue-700'  },
  basse:   { icon: '⚪', label: 'Basse',   badge: 'bg-slate-100 text-slate-500' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  initialTasks: PersonalTask[];
  tenantId:     string;
  userId:       string;
  condensed?:   boolean;   // true = widget 5 tâches pour le dashboard
}

interface FormState {
  name:          string;
  note:          string;
  due:           string;
  priority:      TaskPriority;
  reminder_date: string;
  reminder_time: string;
}

const EMPTY_FORM: FormState = {
  name: '', note: '', due: '', priority: 'normale', reminder_date: '', reminder_time: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function dueBadge(due: string | null): { label: string; cls: string } | null {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(due + 'T12:00:00');
  const diff  = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const label = diff === 0 ? "Aujourd'hui"
              : diff === 1 ? 'Demain'
              : diff < 0  ? `J${diff}`
              : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  const cls   = diff < 0  ? 'bg-red-100 text-red-700'
              : diff === 0 ? 'bg-orange-100 text-orange-700'
              : 'bg-green-100 text-green-700';
  return { label, cls };
}

function sortTasks(tasks: PersonalTask[]): PersonalTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

// ── Composant formulaire inline ───────────────────────────────────────────────

function TaskForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: FormState;
  onSave:   (f: FormState) => void;
  onCancel: () => void;
  saving:   boolean;
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3 shadow-sm">
      {/* Intitulé */}
      <input
        autoFocus
        placeholder="Intitulé de la tâche *"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && form.name.trim()) onSave(form); }}
        className="w-full min-h-[48px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {/* Note */}
      <textarea
        placeholder="Note / détail (optionnel)"
        value={form.note}
        onChange={(e) => set('note', e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
      />
      {/* Échéance + Priorité */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Échéance</label>
          <input
            type="date"
            value={form.due}
            onChange={(e) => set('due', e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Priorité</label>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value as TaskPriority)}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="basse">⚪ Basse</option>
            <option value="normale">🔵 Normale</option>
            <option value="haute">🟠 Haute</option>
            <option value="urgente">🔴 Urgente</option>
          </select>
        </div>
      </div>
      {/* Rappel */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rappel — date</label>
          <input
            type="date"
            value={form.reminder_date}
            onChange={(e) => set('reminder_date', e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rappel — heure</label>
          <input
            type="time"
            value={form.reminder_time}
            onChange={(e) => set('reminder_time', e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={!form.name.trim() || saving}
          onClick={() => onSave(form)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function MesTaches({ initialTasks, tenantId, userId, condensed = false }: Props) {
  const [tasks,        setTasks]        = useState<PersonalTask[]>(initialTasks);
  const [showDone,     setShowDone]     = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<PersonalTask | null>(null);
  const [isPending,    startTransition] = useTransition();
  const [savingId,     setSavingId]     = useState<string | null>(null);

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const visible = condensed
    ? sorted.filter((t) => !t.done).slice(0, 5)
    : showDone ? sorted : sorted.filter((t) => !t.done);

  const doneCount = tasks.filter((t) => t.done).length;
  const lateCount = tasks.filter((t) => {
    if (t.done || !t.due) return false;
    return t.due < new Date().toISOString().split('T')[0];
  }).length;

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function handleToggle(task: PersonalTask) {
    const newDone = !task.done;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: newDone } : t));
    setSavingId(task.id);
    startTransition(async () => {
      await togglePersonalTask(task.id, newDone);
      setSavingId(null);
    });
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  function handleCreate(form: FormState) {
    if (!form.name.trim()) return;
    startTransition(async () => {
      const result = await createPersonalTask(tenantId, userId, {
        name:          form.name,
        note:          form.note || undefined,
        due:           form.due || undefined,
        priority:      form.priority,
        reminder_date: form.reminder_date || undefined,
        reminder_time: form.reminder_time || undefined,
      });
      if (!result.error && result.id) {
        const newTask: PersonalTask = {
          id:         result.id,
          name:       form.name.trim(),
          note:       form.note?.trim() || null,
          done:       false,
          due:        form.due || null,
          priority:   form.priority,
          user_id:    userId,
          tenant_id:  tenantId,
          created_at: new Date().toISOString(),
        };
        setTasks((prev) => [newTask, ...prev]);
      }
      setShowForm(false);
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function handleUpdate(form: FormState) {
    if (!editing || !form.name.trim()) return;
    const id = editing.id;
    setTasks((prev) => prev.map((t) => t.id === id ? {
      ...t,
      name:     form.name.trim(),
      note:     form.note?.trim() || null,
      due:      form.due || null,
      priority: form.priority,
    } : t));
    startTransition(async () => {
      await updatePersonalTask(id, userId, {
        name:          form.name,
        note:          form.note?.trim() || null,
        due:           form.due || null,
        priority:      form.priority,
        reminder_date: form.reminder_date || null,
        reminder_time: form.reminder_time || null,
      });
      setEditing(null);
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(task: PersonalTask) {
    if (!confirm(`Supprimer "${task.name}" ?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      await deletePersonalTask(task.id, userId);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (condensed) {
    // ── Version widget condensé (dashboard dirigeant) ────────────────────────
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text2,#64748b)]">
            📌 Mes tâches
          </p>
          <a
            href="/pilotage/dashboard?tab=taches"
            className="text-[11px] font-semibold text-blue-600 hover:underline"
          >
            Voir toutes →
          </a>
        </div>

        {lateCount > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            ⚠️ {lateCount} tâche{lateCount > 1 ? 's' : ''} en retard
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
            Aucune tâche en cours
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden">
            {visible.map((task) => {
              const prio  = PRIORITY_META[task.priority] ?? PRIORITY_META.normale;
              const badge = dueBadge(task.due);
              return (
                <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    onClick={() => handleToggle(task)}
                    disabled={savingId === task.id}
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      task.done
                        ? 'border-green-500 bg-green-500'
                        : 'border-slate-300 hover:border-blue-400',
                    ].join(' ')}
                  >
                    {task.done && <span className="text-[10px] font-bold text-white">✓</span>}
                  </button>
                  <span className={`flex-1 min-w-0 text-sm truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {task.name}
                  </span>
                  <span className="shrink-0 text-xs">{prio.icon}</span>
                  {badge && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Version complète ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          📌 Mes tâches &amp; notes
          {lateCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {lateCount} en retard
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              {showDone ? 'Masquer terminées' : `Voir terminées (${doneCount})`}
            </button>
          )}
          <button
            onClick={() => { setShowForm(true); setEditing(null); }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 min-h-[44px]"
          >
            <span className="text-base leading-none">+</span>
            <span>Nouvelle tâche</span>
          </button>
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && !editing && (
        <TaskForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={isPending}
        />
      )}

      {/* Liste vide */}
      {visible.length === 0 && !showForm && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-3xl mb-3">📌</p>
          <p className="text-sm font-semibold text-slate-700">Aucune tâche en cours</p>
          <p className="mt-1 text-xs text-slate-400">
            Cliquez sur &quot;+ Nouvelle tâche&quot; ou dictez vocalement &quot;rappelle-moi de…&quot;
          </p>
        </div>
      )}

      {/* Liste des tâches */}
      {visible.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {visible.map((task) => {
            const prio  = PRIORITY_META[task.priority] ?? PRIORITY_META.normale;
            const badge = dueBadge(task.due);
            const isEditing = editing?.id === task.id;

            if (isEditing) {
              return (
                <div key={task.id} className="p-3">
                  <TaskForm
                    key={task.id}
                    initial={{
                      name:          task.name,
                      note:          task.note ?? '',
                      due:           task.due ?? '',
                      priority:      task.priority,
                      reminder_date: '',
                      reminder_time: '',
                    }}
                    onSave={handleUpdate}
                    onCancel={() => setEditing(null)}
                    saving={isPending}
                  />
                </div>
              );
            }

            return (
              <div key={task.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-slate-50 transition-colors">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(task)}
                  disabled={savingId === task.id}
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    task.done
                      ? 'border-green-500 bg-green-500'
                      : 'border-slate-300 hover:border-blue-400',
                    savingId === task.id ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  {task.done && <span className="text-[10px] font-bold text-white">✓</span>}
                </button>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setEditing(task)}
                    className={`text-left text-sm font-medium w-full truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-800 hover:text-blue-600'}`}
                  >
                    {task.name}
                  </button>
                  {task.note && !task.done && (
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{task.note}</p>
                  )}
                  {/* Badges */}
                  {!task.done && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prio.badge}`}>
                        {prio.icon} {prio.label}
                      </span>
                      {badge && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                          📅 {badge.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(task); setShowForm(false); }}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(task)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
