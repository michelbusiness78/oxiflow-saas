'use client';

import { useState, useEffect, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createIntervention, updateIntervention } from '@/app/actions/chef-projet';
import type { CalendarEventData, InterventionInput } from '@/app/actions/chef-projet';

interface Client  { id: string; nom: string }
interface UserRow { id: string; name: string }

interface Props {
  open:      boolean;
  onClose:   () => void;
  onSaved:   () => void;
  editing?:  CalendarEventData | null;
  clients:   Client[];
  users:     UserRow[];
  defaultStart?: string;  // ISO — pré-remplit les dates si on clique sur le calendrier
}

const STATUS_OPTIONS = [
  { value: 'planifiee', label: 'Planifiée'  },
  { value: 'en_cours',  label: 'En cours'   },
  { value: 'terminee',  label: 'Terminée'   },
  { value: 'annulee',   label: 'Annulée'    },
];

const TYPE_OPTIONS = [
  { value: 'installation',  label: 'Installation'  },
  { value: 'maintenance',   label: 'Maintenance'   },
  { value: 'depannage',     label: 'Dépannage'     },
  { value: 'formation',     label: 'Formation'     },
  { value: 'autre',         label: 'Autre'         },
];

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTime(local: string): string {
  return new Date(local).toISOString();
}

export function InterventionFormModal({
  open, onClose, onSaved, editing, clients, users, defaultStart,
}: Props) {
  const isEdit = !!editing && editing.type === 'intervention';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const defaultStartLocal = defaultStart
    ? toLocalDateTime(defaultStart)
    : (() => {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        return toLocalDateTime(d.toISOString());
      })();

  const defaultEndLocal = (() => {
    const d = new Date(defaultStart ?? new Date());
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return toLocalDateTime(d.toISOString());
  })();

  const [form, setForm] = useState({
    title:        '',
    date_start:   defaultStartLocal,
    date_end:     defaultEndLocal,
    client_id:    '',
    tech_user_id: '',
    status:       'planifiee',
    type:         'intervention',
    notes:        '',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && editing) {
      setForm({
        title:        editing.title,
        date_start:   toLocalDateTime(editing.startISO),
        date_end:     toLocalDateTime(editing.endISO),
        client_id:    editing.client_id    ?? '',
        tech_user_id: editing.tech_user_id ?? '',
        status:       editing.status ?? 'planifiee',
        type:         editing.type ?? 'intervention',
        notes:        editing.notes ?? '',
      });
    } else {
      const start = defaultStart ? toLocalDateTime(defaultStart) : defaultStartLocal;
      const end   = (() => {
        const d = new Date(defaultStart ?? new Date());
        d.setHours(d.getHours() + 2, 0, 0, 0);
        return toLocalDateTime(d.toISOString());
      })();
      setForm({
        title:        '',
        date_start:   start,
        date_end:     end,
        client_id:    '',
        tech_user_id: '',
        status:       'planifiee',
        type:         'intervention',
        notes:        '',
      });
    }
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est obligatoire.'); return; }
    if (!form.date_start)   { setError('La date de début est obligatoire.'); return; }
    setError('');

    startTransition(async () => {
      const techUser = users.find((u) => u.id === form.tech_user_id);

      const input: InterventionInput = {
        title:         form.title.trim(),
        date_start:    fromLocalDateTime(form.date_start),
        date_end:      form.date_end ? fromLocalDateTime(form.date_end) : undefined,
        client_id:     form.client_id || undefined,
        tech_user_id:  form.tech_user_id || undefined,
        tech_name:     techUser?.name,
        status:        form.status,
        type:          form.type,
        notes:         form.notes.trim() || undefined,
      };

      const res = isEdit && editing
        ? await updateIntervention(editing.id, input)
        : await createIntervention(input);

      if (res.error) { setError(res.error); return; }
      onSaved();
      onClose();
    });
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 pb-24">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Titre */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Installation climatisation bureau 2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Début <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.date_start}
              onChange={(e) => set('date_start', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Fin</label>
            <input
              type="datetime-local"
              value={form.date_end}
              onChange={(e) => set('date_end', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Client */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Client</label>
          <select
            value={form.client_id}
            onChange={(e) => set('client_id', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        {/* Technicien */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Technicien</label>
          <select
            value={form.tech_user_id}
            onChange={(e) => set('tech_user_id', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— Sélectionner un technicien —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Type + Statut */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Type</label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Statut</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Instructions, accès, matériel nécessaire…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="fixed bottom-0 right-0 w-full max-w-lg border-t border-slate-200 bg-white px-5 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
