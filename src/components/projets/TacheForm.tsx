'use client';

import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createTacheAction, updateTacheAction, type TacheInput } from '@/app/actions/taches';

interface Dossier { id: string; nom: string; }
interface User    { id: string; nom: string; prenom: string; }

export interface Tache {
  id:              string;
  projet_id:       string | null;
  titre:           string;
  description:     string | null;
  assigne_a:       string | null;
  priorite:        'faible' | 'normale' | 'haute' | 'urgente';
  etat:            'a_faire' | 'en_cours' | 'en_review' | 'terminee';
  date_echeance:   string | null;
  pct_avancement:  number;
  created_at:      string;
}

interface TacheFormProps {
  open:        boolean;
  onClose:     () => void;
  dossiers:    Dossier[];
  users:       User[];
  editing?:    Tache | null;
  defaultProjetId?: string | null;
}

const PRIORITES: { value: TacheInput['priorite']; label: string }[] = [
  { value: 'faible',   label: 'Faible'   },
  { value: 'normale',  label: 'Normale'  },
  { value: 'haute',    label: 'Haute'    },
  { value: 'urgente',  label: 'Urgente'  },
];

const ETATS: { value: TacheInput['etat']; label: string }[] = [
  { value: 'a_faire',   label: 'À faire'   },
  { value: 'en_cours',  label: 'En cours'  },
  { value: 'en_review', label: 'En review' },
  { value: 'terminee',  label: 'Terminée'  },
];

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

export function TacheForm({ open, onClose, dossiers, users, editing, defaultProjetId }: TacheFormProps) {
  const [projetId,  setProjetId]  = useState(editing?.projet_id     ?? defaultProjetId ?? '');
  const [titre,     setTitre]     = useState(editing?.titre         ?? '');
  const [desc,      setDesc]      = useState(editing?.description   ?? '');
  const [assigneA,  setAssigneA]  = useState(editing?.assigne_a     ?? '');
  const [priorite,  setPriorite]  = useState<TacheInput['priorite']>(editing?.priorite ?? 'normale');
  const [etat,      setEtat]      = useState<TacheInput['etat']>(editing?.etat ?? 'a_faire');
  const [echeance,  setEcheance]  = useState(editing?.date_echeance ?? '');
  const [pct,       setPct]       = useState(String(editing?.pct_avancement ?? 0));
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError('Le titre est requis.'); return; }
    setSaving(true);
    setError('');

    const input: TacheInput = {
      projet_id:      projetId  || null,
      titre:          titre.trim(),
      description:    desc.trim() || null,
      assigne_a:      assigneA  || null,
      priorite,
      etat,
      date_echeance:  echeance  || null,
      pct_avancement: parseInt(pct) || 0,
    };

    const res = editing
      ? await updateTacheAction(editing.id, input)
      : await createTacheAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex-1 space-y-4 p-5">
          {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

          {/* Titre */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Titre <span className="text-oxi-danger">*</span></label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Maquetter la page d'accueil" className={inputCls} required />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Description <span className="text-slate-400">(optionnel)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Détails de la tâche…" className={`${inputCls} resize-none`} />
          </div>

          {/* Dossier lié */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Dossier / Projet</label>
            <select value={projetId} onChange={(e) => setProjetId(e.target.value)} className={inputCls}>
              <option value="">— Aucun —</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>

          {/* Assigné + Priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Assigné à</label>
              <select value={assigneA} onChange={(e) => setAssigneA(e.target.value)} className={inputCls}>
                <option value="">— Non assigné —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Priorité</label>
              <select value={priorite} onChange={(e) => setPriorite(e.target.value as TacheInput['priorite'])} className={inputCls}>
                {PRIORITES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* État + Échéance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">État</label>
              <select value={etat} onChange={(e) => setEtat(e.target.value as TacheInput['etat'])} className={inputCls}>
                {ETATS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Échéance</label>
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Avancement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">Avancement</label>
              <span className="text-sm font-semibold text-blue-600">{parseInt(pct) || 0}%</span>
            </div>
            <input
              type="range"
              value={parseInt(pct) || 0}
              onChange={(e) => setPct(e.target.value)}
              min="0"
              max="100"
              step="10"
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white shadow-sm p-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer la tâche'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
