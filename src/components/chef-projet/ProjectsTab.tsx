'use client';

import { useState, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { ProjectList } from '@/components/projets/ProjectList';
import { createProjectAction } from '@/app/actions/projects';
import type { Project } from '@/app/actions/projects';

interface Client { id: string; nom: string; }
interface TaskCount { done: number; total: number; }

interface Props {
  projects:    Project[];
  users:       { id: string; name: string }[];
  taskCounts:  Record<string, TaskCount>;
  clients:     Client[];
  notifIds?:   string[];  // project IDs with unread notifications
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200';

export function ProjectsTab({ projects, users, taskCounts, clients, notifIds = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Form fields
  const [name,        setName]        = useState('');
  const [clientId,    setClientId]    = useState('');
  const [type,        setType]        = useState('');
  const [deadline,    setDeadline]    = useState('');
  const [description, setDescription] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    setError('');
    startTransition(async () => {
      const res = await createProjectAction({
        name:        name.trim(),
        client_id:   clientId || null,
        deadline:    deadline || null,
        type:        type || null,
        description: description || null,
      });
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      setName(''); setClientId(''); setType(''); setDeadline(''); setDescription('');
    });
  }

  function handleClose() {
    setOpen(false);
    setError('');
    setName(''); setClientId(''); setType(''); setDeadline(''); setDescription('');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Projets
          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {projects.length}
          </span>
          {notifIds.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {notifIds.length} nouveau{notifIds.length > 1 ? 'x' : ''}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Nouveau projet
        </button>
      </div>

      {/* Liste */}
      <ProjectList
        projects={projects}
        users={users}
        taskCounts={taskCounts}
        detailBaseUrl="/chef-projet?project="
      />

      {/* Formulaire création */}
      <SlideOver open={open} onClose={handleClose} title="Nouveau projet">
        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nom du projet *</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Installation réseau bureaux…" className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">— Sans client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="">— Sélectionner —</option>
              <option value="installation">Installation</option>
              <option value="maintenance">Maintenance</option>
              <option value="vente">Vente / Devis</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Échéance</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} placeholder="Contexte, notes…"
              className={`${inputCls} resize-y min-h-[72px]`}
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || isPending}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Création…' : 'Créer le projet'}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
