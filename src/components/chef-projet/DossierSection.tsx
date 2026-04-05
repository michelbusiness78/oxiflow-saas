'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { SlideOver }   from '@/components/ui/SlideOver';
import { ProjetList, type ProjetCard } from './ProjetList';
import { createDossierAction }         from '@/app/actions/dossiers';
import { addProjectTask }              from '@/app/actions/project-tasks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client      { id: string; nom: string; }
interface ProjectItem { id: string; name: string; }

interface Props {
  projets:    ProjetCard[];
  clients:    Client[];
  projectsR4: ProjectItem[];
  tenantId:   string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES = ['Développement', 'Intégration', 'Formation', 'Conseil', 'Maintenance', 'SAV', 'Autre'];

const STATUTS = [
  { value: 'ouvert',   label: 'Ouvert'   },
  { value: 'en_cours', label: 'En cours' },
  { value: 'ferme',    label: 'Fermé'    },
  { value: 'annule',   label: 'Annulé'   },
];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

// ─── DossierSection ───────────────────────────────────────────────────────────

export function DossierSection({ projets, clients, projectsR4, tenantId }: Props) {
  const router = useRouter();

  // ── Formulaire dossier ───────────────────────────────────────────────────────
  const [dossierOpen, setDossierOpen] = useState(false);
  const [clientId,    setClientId]    = useState('');
  const [typeProjet,  setTypeProjet]  = useState('');
  const [statut,      setStatut]      = useState('ouvert');
  const [notes,       setNotes]       = useState('');
  const [dossierErr,  setDossierErr]  = useState('');
  const [savingD,     setSavingD]     = useState(false);

  // ── Formulaire tâche ─────────────────────────────────────────────────────────
  const [taskOpen,    setTaskOpen]    = useState(false);
  const [taskProject, setTaskProject] = useState('');
  const [taskName,    setTaskName]    = useState('');
  const [taskDue,     setTaskDue]     = useState('');
  const [taskErr,     setTaskErr]     = useState('');
  const [savingT,     setSavingT]     = useState(false);

  // ── Handlers dossier ─────────────────────────────────────────────────────────

  function openDossierForm() {
    setClientId(''); setTypeProjet(''); setStatut('ouvert'); setNotes(''); setDossierErr('');
    setDossierOpen(true);
  }

  async function handleDossierSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setDossierErr('Veuillez sélectionner un client.'); return; }
    setDossierErr('');
    setSavingD(true);
    const res = await createDossierAction({
      client_id:   clientId,
      type_projet: typeProjet || null,
      statut,
      notes:       notes || null,
    });
    setSavingD(false);
    if (res.error) { setDossierErr(res.error); return; }
    setDossierOpen(false);
    router.refresh();
  }

  // ── Handlers tâche ───────────────────────────────────────────────────────────

  function openTaskForm() {
    setTaskProject(projectsR4[0]?.id ?? ''); setTaskName(''); setTaskDue(''); setTaskErr('');
    setTaskOpen(true);
  }

  async function handleTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskProject) { setTaskErr('Veuillez sélectionner un projet.'); return; }
    if (!taskName.trim()) { setTaskErr('Le nom de la tâche est requis.'); return; }
    setTaskErr('');
    setSavingT(true);
    const res = await addProjectTask(taskProject, tenantId, taskName.trim(), taskDue || undefined);
    setSavingT(false);
    if (res.error) { setTaskErr(res.error); return; }
    setTaskOpen(false);
    router.refresh();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* En-tête section */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">
          Mes dossiers
          {projets.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({projets.length})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {projectsR4.length > 0 && (
            <button
              type="button"
              onClick={openTaskForm}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvelle tâche
            </button>
          )}
          <button
            type="button"
            onClick={openDossierForm}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau dossier
          </button>
        </div>
      </div>

      {/* Liste dossiers legacy */}
      {projets.length > 0 ? (
        <ProjetList projets={projets} clients={clients} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          Aucun dossier assigné
        </div>
      )}

      {/* ── SlideOver : Nouveau dossier ─────────────────────────────────────── */}
      <SlideOver open={dossierOpen} onClose={() => setDossierOpen(false)} title="Nouveau dossier">
        <form onSubmit={handleDossierSubmit} className="flex flex-col">
          <div className="flex-1 space-y-4 p-5">
            {dossierErr && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{dossierErr}</div>
            )}

            {/* Client */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Client <span className="text-red-500">*</span>
              </label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Type de projet</label>
              <select value={typeProjet} onChange={(e) => setTypeProjet(e.target.value)} className={inputCls}>
                <option value="">— Choisir —</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Statut */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Statut</label>
              <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inputCls}>
                {STATUTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Informations complémentaires…"
                className={inputCls}
              />
            </div>
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white shadow-sm p-5">
            <button
              type="button"
              onClick={() => setDossierOpen(false)}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={savingD}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {savingD ? 'Enregistrement…' : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* ── SlideOver : Nouvelle tâche ──────────────────────────────────────── */}
      <SlideOver open={taskOpen} onClose={() => setTaskOpen(false)} title="Nouvelle tâche">
        <form onSubmit={handleTaskSubmit} className="flex flex-col">
          <div className="flex-1 space-y-4 p-5">
            {taskErr && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{taskErr}</div>
            )}

            {/* Projet */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Projet <span className="text-red-500">*</span>
              </label>
              <select value={taskProject} onChange={(e) => setTaskProject(e.target.value)} className={inputCls}>
                <option value="">— Sélectionner un projet —</option>
                {projectsR4.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Nom */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Nom de la tâche <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Ex. Réviser la documentation"
                className={inputCls}
                required
              />
            </div>

            {/* Échéance */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Date d'échéance <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white shadow-sm p-5">
            <button
              type="button"
              onClick={() => setTaskOpen(false)}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={savingT}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {savingT ? 'Enregistrement…' : 'Créer la tâche'}
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
