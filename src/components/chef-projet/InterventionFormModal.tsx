'use client';

import { useState, useEffect, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createIntervention, updateIntervention } from '@/app/actions/chef-projet';
import type { CalendarEventData, InterventionInput, ProjectForPlanning } from '@/app/actions/chef-projet';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientFull {
  id:      string;
  nom:     string;
  ville:   string | null;
  adresse: string | null;
  tel:     string | null;
}

interface UserRow { id: string; name: string }

type Nature = 'projet' | 'sav';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:         boolean;
  onClose:      () => void;
  onSaved:      () => void;
  editing?:     CalendarEventData | null;
  clients:      ClientFull[];
  techniciens:  UserRow[];
  projects:     ProjectForPlanning[];
  contractedClientIds: string[];
  defaultStart?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_INTERVENTION_OPTIONS = [
  { value: 'reseau',      label: 'Réseau / Fibre'  },
  { value: 'securite',    label: 'Sécurité'        },
  { value: 'telephonie',  label: 'Téléphonie'      },
  { value: 'informatique',label: 'Informatique'    },
  { value: 'autre',       label: 'Autre'           },
];

const URGENCY_OPTIONS = [
  { value: 'normal',   label: '🟢 Normal'   },
  { value: 'urgent',   label: '🟡 Urgent'   },
  { value: 'critique', label: '🔴 Critique' },
];

const STATUS_OPTIONS = [
  { value: 'planifiee', label: 'Planifiée' },
  { value: 'en_cours',  label: 'En cours'  },
  { value: 'terminee',  label: 'Terminée'  },
  { value: 'annulee',   label: 'Annulée'   },
];

const TYPE_OPTIONS = [
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance',  label: 'Maintenance'  },
  { value: 'depannage',    label: 'Dépannage'    },
  { value: 'formation',    label: 'Formation'    },
  { value: 'autre',        label: 'Autre'        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function toLocalDateTime(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDateTimes(date: string, hoursPlanned: number, dateEnd?: string) {
  const start = new Date(`${date}T08:00:00`);
  const end   = (dateEnd && dateEnd > date)
    ? new Date(`${dateEnd}T18:00:00`)
    : new Date(start.getTime() + hoursPlanned * 3600_000);
  return { date_start: start.toISOString(), date_end: end.toISOString() };
}

// ── Sous-formulaire Projet ────────────────────────────────────────────────────

interface ProjetFormState {
  project_id:   string;
  tech_user_id: string;
  date:         string;
  date_end:     string;
  hours_planned: number;
  notes:        string;
}

function ProjetForm({
  form, setForm, projects, techniciens, selectedProject,
}: {
  form:            ProjetFormState;
  setForm:         React.Dispatch<React.SetStateAction<ProjetFormState>>;
  projects:        ProjectForPlanning[];
  techniciens:     UserRow[];
  selectedProject: ProjectForPlanning | null;
}) {
  const set = (field: keyof ProjetFormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      {/* Projet */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Projet <span className="text-red-500">*</span>
        </label>
        <select
          value={form.project_id}
          onChange={(e) => set('project_id', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner un projet —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.client_nom}{p.affair_number ? ` · ${p.affair_number}` : ''}
            </option>
          ))}
        </select>
        {projects.length === 0 && (
          <p className="text-xs text-slate-400">Aucun projet en cours pour ce tenant.</p>
        )}
      </div>

      {/* Infos client (auto-fill depuis le projet) */}
      {selectedProject && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 space-y-1 text-sm">
          <p className="font-semibold text-blue-800">{selectedProject.client_nom}</p>
          {selectedProject.client_address && (
            <p className="text-blue-600 text-xs">
              📍 {[selectedProject.client_address, selectedProject.client_city].filter(Boolean).join(', ')}
            </p>
          )}
          {selectedProject.client_phone && (
            <p className="text-blue-600 text-xs">📞 {selectedProject.client_phone}</p>
          )}
        </div>
      )}

      {/* Technicien */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Technicien</label>
        <select
          value={form.tech_user_id}
          onChange={(e) => set('tech_user_id', e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner un technicien —</option>
          {techniciens.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Date début + Date fin */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Date début <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Date fin <span className="text-slate-400 font-normal">(si multi-jours)</span>
          </label>
          <input
            type="date"
            value={form.date_end}
            min={form.date}
            onChange={(e) => set('date_end', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Heures prévues */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Heures prévues{form.date_end && form.date_end > form.date ? ' (par jour)' : ''}
        </label>
        <input
          type="number"
          value={form.hours_planned}
          onChange={(e) => set('hours_planned', parseFloat(e.target.value) || 8)}
          step={0.5}
          min={0.5}
          max={24}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Instructions <span className="text-slate-400 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Instructions pour le technicien, accès chantier, matériel à prévoir…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Sous-formulaire SAV ───────────────────────────────────────────────────────

interface SavFormState {
  client_id:         string;
  titre:             string;
  type_intervention: string;
  tech_user_id:      string;
  date:              string;
  date_end:          string;
  hours_planned:     number;
  urgency:           string;
  description:       string;
}

function SavForm({
  form, setForm, clients, techniciens, contractedClientIds,
}: {
  form:                SavFormState;
  setForm:             React.Dispatch<React.SetStateAction<SavFormState>>;
  clients:             ClientFull[];
  techniciens:         UserRow[];
  contractedClientIds: string[];
}) {
  const set = (field: keyof SavFormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectedClient = clients.find((c) => c.id === form.client_id) ?? null;
  const underContract  = form.client_id ? contractedClientIds.includes(form.client_id) : null;

  return (
    <div className="space-y-5">
      {/* Client */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Client <span className="text-red-500">*</span>
        </label>
        <select
          value={form.client_id}
          onChange={(e) => set('client_id', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner un client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}{c.ville ? ` · ${c.ville}` : ''}
            </option>
          ))}
        </select>

        {/* Badge contrat */}
        {underContract !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
              underContract
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {underContract ? '✅ Sous contrat' : '⚠ Hors contrat'}
          </span>
        )}

        {/* Infos client auto-fill */}
        {selectedClient && (selectedClient.adresse || selectedClient.tel) && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-0.5 text-xs text-slate-600">
            {selectedClient.adresse && (
              <p>📍 {[selectedClient.adresse, selectedClient.ville].filter(Boolean).join(', ')}</p>
            )}
            {selectedClient.tel && <p>📞 {selectedClient.tel}</p>}
          </div>
        )}
      </div>

      {/* Titre */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Titre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.titre}
          onChange={(e) => set('titre', e.target.value)}
          placeholder="Ex: Panne switch bureau 2ème étage"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Type d'intervention</label>
        <select
          value={form.type_intervention}
          onChange={(e) => set('type_intervention', e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner —</option>
          {TYPE_INTERVENTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
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
          {techniciens.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Date début + Date fin */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Date début <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Date fin <span className="text-slate-400 font-normal">(si multi-jours)</span>
          </label>
          <input
            type="date"
            value={form.date_end}
            min={form.date}
            onChange={(e) => set('date_end', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Heures prévues */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Heures prévues{form.date_end && form.date_end > form.date ? ' (par jour)' : ''}
        </label>
        <input
          type="number"
          value={form.hours_planned}
          onChange={(e) => set('hours_planned', parseFloat(e.target.value) || 4)}
          step={0.5}
          min={0.5}
          max={24}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Urgence */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Urgence</label>
        <div className="flex gap-2">
          {URGENCY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set('urgency', o.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                form.urgency === o.value
                  ? o.value === 'critique'
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : o.value === 'urgent'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-green-400 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description du problème */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">
          Description du problème <span className="text-slate-400 font-normal">(visible par le technicien)</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={4}
          placeholder="Décrivez le problème signalé, les symptômes observés, les actions déjà entreprises…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Formulaire d'édition (conserve l'ancien comportement) ─────────────────────

interface EditFormState {
  title:        string;
  date_start:   string;
  date_end:     string;
  client_id:    string;
  tech_user_id: string;
  status:       string;
  type:         string;
  notes:        string;
}

function EditForm({
  form, setForm, clients, techniciens,
}: {
  form:        EditFormState;
  setForm:     React.Dispatch<React.SetStateAction<EditFormState>>;
  clients:     ClientFull[];
  techniciens: UserRow[];
}) {
  const set = (field: keyof EditFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Titre <span className="text-red-500">*</span></label>
        <input
          type="text" value={form.title} onChange={(e) => set('title', e.target.value)} required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Début <span className="text-red-500">*</span></label>
          <input
            type="datetime-local" value={form.date_start} onChange={(e) => set('date_start', e.target.value)} required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Fin</label>
          <input
            type="datetime-local" value={form.date_end} onChange={(e) => set('date_end', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Client</label>
        <select value={form.client_id} onChange={(e) => set('client_id', e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Technicien</label>
        <select value={form.tech_user_id} onChange={(e) => set('tech_user_id', e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Sélectionner —</option>
          {techniciens.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Statut</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-700">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          placeholder="Instructions, accès, matériel nécessaire…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function InterventionFormModal({
  open, onClose, onSaved, editing, clients, techniciens, projects, contractedClientIds, defaultStart,
}: Props) {
  const isEdit = !!editing && editing.type === 'intervention';
  const [isPending, startTransition] = useTransition();
  const [error,     setError]        = useState('');
  const [nature,    setNature]        = useState<Nature>('projet');

  // ── État Projet ──────────────────────────────────────────────────────────────

  const defaultDate = defaultStart
    ? new Date(defaultStart).toISOString().split('T')[0]
    : todayDate();

  const [projetForm, setProjetForm] = useState<ProjetFormState>({
    project_id:   '',
    tech_user_id: '',
    date:         defaultDate,
    date_end:     '',
    hours_planned: 8,
    notes:        '',
  });

  // ── État SAV ─────────────────────────────────────────────────────────────────

  const [savForm, setSavForm] = useState<SavFormState>({
    client_id:         '',
    titre:             '',
    type_intervention: '',
    tech_user_id:      '',
    date:              defaultDate,
    date_end:          '',
    hours_planned:     4,
    urgency:           'normal',
    description:       '',
  });

  // ── État édition ─────────────────────────────────────────────────────────────

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

  const [editForm, setEditForm] = useState<EditFormState>({
    title:        '',
    date_start:   defaultStartLocal,
    date_end:     defaultEndLocal,
    client_id:    '',
    tech_user_id: '',
    status:       'planifiee',
    type:         'intervention',
    notes:        '',
  });

  // ── Reset à l'ouverture ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const newDate = defaultStart
      ? new Date(defaultStart).toISOString().split('T')[0]
      : todayDate();

    if (isEdit && editing) {
      setEditForm({
        title:        editing.title,
        date_start:   toLocalDateTime(editing.startISO),
        date_end:     toLocalDateTime(editing.endISO),
        client_id:    editing.client_id    ?? '',
        tech_user_id: editing.tech_user_id ?? '',
        status:       editing.status       ?? 'planifiee',
        type:         editing.type         ?? 'intervention',
        notes:        editing.notes        ?? '',
      });
    } else {
      setNature('projet');
      setProjetForm({
        project_id:    '',
        tech_user_id:  '',
        date:          newDate,
        date_end:      '',
        hours_planned: 8,
        notes:         '',
      });
      setSavForm({
        client_id:         '',
        titre:             '',
        type_intervention: '',
        tech_user_id:      '',
        date:              newDate,
        date_end:          '',
        hours_planned:     4,
        urgency:           'normal',
        description:       '',
      });
    }
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // ── Projet sélectionné ───────────────────────────────────────────────────────

  const selectedProject = projects.find((p) => p.id === projetForm.project_id) ?? null;

  // ── Soumission ────────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      let input: InterventionInput;

      if (isEdit) {
        // Mode édition (formulaire classique)
        if (!editForm.title.trim()) { setError('Le titre est obligatoire.'); return; }
        const techUser = techniciens.find((u) => u.id === editForm.tech_user_id);
        input = {
          title:        editForm.title.trim(),
          date_start:   new Date(editForm.date_start).toISOString(),
          date_end:     editForm.date_end ? new Date(editForm.date_end).toISOString() : undefined,
          client_id:    editForm.client_id || undefined,
          tech_user_id: editForm.tech_user_id || undefined,
          tech_name:    techUser?.name,
          status:       editForm.status,
          type:         editForm.type,
          notes:        editForm.notes.trim() || undefined,
        };
        const res = await updateIntervention(editing!.id, input);
        if (res.error) { setError(res.error); return; }

      } else if (nature === 'projet') {
        // Création Projet
        if (!projetForm.project_id) { setError('Veuillez sélectionner un projet.'); return; }
        if (!projetForm.date)       { setError('La date est obligatoire.'); return; }
        const techUser = techniciens.find((u) => u.id === projetForm.tech_user_id);
        const { date_start, date_end } = buildDateTimes(projetForm.date, projetForm.hours_planned, projetForm.date_end || undefined);
        input = {
          title:         selectedProject?.name ?? 'Intervention',
          date_start,
          date_end,
          client_id:     selectedProject?.client_id ?? undefined,
          project_id:    projetForm.project_id,
          tech_user_id:  projetForm.tech_user_id || undefined,
          tech_name:     techUser?.name,
          status:        'planifiee',
          nature:        'projet',
          hours_planned: projetForm.hours_planned,
          notes:         projetForm.notes.trim() || undefined,
        };
        const res = await createIntervention(input);
        if (res.error) { setError(res.error); return; }

      } else {
        // Création SAV
        if (!savForm.client_id) { setError('Veuillez sélectionner un client.'); return; }
        if (!savForm.titre.trim()) { setError('Le titre est obligatoire.'); return; }
        if (!savForm.date)         { setError('La date est obligatoire.'); return; }
        const techUser = techniciens.find((u) => u.id === savForm.tech_user_id);
        const underContract = savForm.client_id ? contractedClientIds.includes(savForm.client_id) : false;
        const { date_start, date_end } = buildDateTimes(savForm.date, savForm.hours_planned, savForm.date_end || undefined);
        input = {
          title:             savForm.titre.trim(),
          date_start,
          date_end,
          client_id:         savForm.client_id,
          project_id:        undefined,
          tech_user_id:      savForm.tech_user_id || undefined,
          tech_name:         techUser?.name,
          status:            'planifiee',
          nature:            'sav',
          type_intervention: savForm.type_intervention || undefined,
          urgency:           savForm.urgency,
          hours_planned:     savForm.hours_planned,
          under_contract:    underContract,
          observations:      savForm.description.trim() || undefined,
        };
        const res = await createIntervention(input);
        if (res.error) { setError(res.error); return; }
      }

      onSaved();
      onClose();
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier l'intervention" : 'Nouvelle intervention'}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 pb-24">

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Toggle Projet / SAV (création uniquement) */}
        {!isEdit && (
          <div className="flex gap-0 rounded-xl border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setNature('projet')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                nature === 'projet'
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🏗 Projet
            </button>
            <button
              type="button"
              onClick={() => setNature('sav')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                nature === 'sav'
                  ? 'bg-white text-orange-600 shadow-sm border border-orange-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🔧 SAV
            </button>
          </div>
        )}

        {/* Corps du formulaire */}
        {isEdit ? (
          <EditForm
            form={editForm}
            setForm={setEditForm}
            clients={clients}
            techniciens={techniciens}
          />
        ) : nature === 'projet' ? (
          <ProjetForm
            form={projetForm}
            setForm={setProjetForm}
            projects={projects}
            techniciens={techniciens}
            selectedProject={selectedProject}
          />
        ) : (
          <SavForm
            form={savForm}
            setForm={setSavForm}
            clients={clients}
            techniciens={techniciens}
            contractedClientIds={contractedClientIds}
          />
        )}

        {/* Footer fixe */}
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
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              !isEdit && nature === 'sav'
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPending
              ? 'Enregistrement…'
              : isEdit
              ? 'Mettre à jour'
              : nature === 'sav'
              ? '✅ Créer l\'intervention SAV'
              : '✅ Créer l\'intervention'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
