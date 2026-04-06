'use client';

import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO } from '@/lib/format';
import {
  createContratAction,
  updateContratAction,
  type ContratInput,
  type MaterielCouvert,
  type ContratStatut,
  type ContratFrequence,
} from '@/app/actions/contrats';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client  { id: string; nom: string; }
interface Company { id: string; name: string; }
interface Project { id: string; name: string; client_id: string | null; }

export interface Contrat {
  id:               string;
  client_id:        string;
  type:             'maintenance' | 'support' | 'location';
  nom:              string | null;
  numero:           string | null;
  description:      string | null;
  frequence:        ContratFrequence | null;
  date_debut:       string;
  date_fin:         string | null;
  montant_mensuel:  number | null;
  statut:           ContratStatut;
  actif:            boolean;
  materiel_couvert: MaterielCouvert[];
  project_id:       string | null;
  company_id:       string | null;
  notes:            string | null;
  created_at:       string;
}

interface ContratFormProps {
  open:      boolean;
  onClose:   () => void;
  clients:   Client[];
  companies: Company[];
  projects:  Project[];
  editing?:  Contrat | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_LABELS = { maintenance: 'Maintenance', support: 'Support', location: 'Location' };

const FREQUENCE_LABELS: Record<ContratFrequence, string> = {
  mensuel:      'Mensuel',
  trimestriel:  'Trimestriel',
  annuel:       'Annuel',
};

const STATUT_META: Record<ContratStatut, { label: string; bg: string; text: string }> = {
  actif:    { label: 'Actif',    bg: 'bg-green-100',  text: 'text-green-700'  },
  expire:   { label: 'Expiré',   bg: 'bg-amber-100',  text: 'text-amber-700'  },
  resilie:  { label: 'Résilié',  bg: 'bg-red-100',    text: 'text-red-700'    },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ContratForm({ open, onClose, clients, companies, projects, editing }: ContratFormProps) {
  const today = todayISO();

  // Identification
  const [clientId,    setClientId]    = useState(editing?.client_id        ?? '');
  const [nom,         setNom]         = useState(editing?.nom               ?? '');
  const [description, setDescription] = useState(editing?.description       ?? '');

  // Paramètres
  const [type,       setType]       = useState<ContratInput['type']>(editing?.type          ?? 'maintenance');
  const [frequence,  setFrequence]  = useState<ContratFrequence>(editing?.frequence          ?? 'mensuel');
  const [montant,    setMontant]    = useState(String(editing?.montant_mensuel              ?? ''));
  const [companyId,  setCompanyId]  = useState(editing?.company_id                          ?? '');
  const [projectId,  setProjectId]  = useState(editing?.project_id                          ?? '');

  // Matériel couvert
  const [materiels,  setMateriels]  = useState<MaterielCouvert[]>(editing?.materiel_couvert ?? []);
  const [matDesig,   setMatDesig]   = useState('');
  const [matRef,     setMatRef]     = useState('');
  const [matSerial,  setMatSerial]  = useState('');
  const [matQty,     setMatQty]     = useState('1');

  // Notes & Statut
  const [notes,      setNotes]      = useState(editing?.notes                               ?? '');
  const [statut,     setStatut]     = useState<ContratStatut>(editing?.statut               ?? 'actif');
  const [dateDebut,  setDateDebut]  = useState(editing?.date_debut                          ?? today);
  const [dateFin,    setDateFin]    = useState(editing?.date_fin                            ?? '');

  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);

  // Projets filtrés par client sélectionné
  const clientProjects = clientId
    ? projects.filter((p) => p.client_id === clientId)
    : [];

  // Calcul mensualité selon fréquence
  const montantNum = montant ? parseFloat(montant) : 0;
  const montantAn  = frequence === 'mensuel' ? montantNum * 12
                   : frequence === 'trimestriel' ? montantNum * 4
                   : montantNum;

  function addMateriel() {
    if (!matDesig.trim()) return;
    setMateriels((prev) => [...prev, {
      id:           crypto.randomUUID(),
      designation:  matDesig.trim(),
      reference:    matRef.trim()    || null,
      numero_serie: matSerial.trim() || null,
      quantite:     parseInt(matQty, 10) || 1,
    }]);
    setMatDesig(''); setMatRef(''); setMatSerial(''); setMatQty('1');
  }

  function removeMateriel(id: string) {
    setMateriels((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    setSaving(true); setError('');

    const input: ContratInput = {
      client_id:        clientId,
      type,
      nom:              nom.trim()         || null,
      description:      description.trim() || null,
      frequence:        frequence          || null,
      montant_mensuel:  montant ? parseFloat(montant) : null,
      date_debut:       dateDebut,
      date_fin:         dateFin  || null,
      statut,
      actif:            statut === 'actif',
      materiel_couvert: materiels,
      project_id:       projectId  || null,
      company_id:       companyId  || null,
      notes:            notes.trim() || null,
    };

    const res = editing
      ? await updateContratAction(editing.id, input)
      : await createContratAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
  const labelCls = 'block text-sm font-semibold text-slate-700';

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? 'Modifier le contrat' : 'Nouveau contrat'}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex-1 space-y-5 p-5 overflow-y-auto">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* ── IDENTIFICATION ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Identification</p>

            {editing?.numero && (
              <div className="space-y-1.5">
                <label className={labelCls}>Numéro</label>
                <input type="text" readOnly value={editing.numero} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono text-slate-500" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className={labelCls}>Client <span className="text-red-500">*</span></label>
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(''); }} className={inputCls}>
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Nom du contrat</label>
              <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Maintenance annuelle équipements" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Décrivez le périmètre du contrat…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── PARAMÈTRES ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paramètres</p>

            <div className="space-y-1.5">
              <label className={labelCls}>Type de contrat</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TYPE_LABELS) as ContratInput['type'][]).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)} className={[
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    type === t ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  ].join(' ')}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Fréquence de facturation</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FREQUENCE_LABELS) as ContratFrequence[]).map((f) => (
                  <button key={f} type="button" onClick={() => setFrequence(f)} className={[
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    frequence === f ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  ].join(' ')}>
                    {FREQUENCE_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Montant (€) par {FREQUENCE_LABELS[frequence].toLowerCase()}</label>
              <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
              {montantNum > 0 && (
                <p className="text-xs text-slate-400">{fmtEur(montantAn)} / an</p>
              )}
            </div>

            {companies.length > 0 && (
              <div className="space-y-1.5">
                <label className={labelCls}>Société émettrice</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={labelCls}>Projet lié <span className="text-slate-400 font-normal">(optionnel)</span></label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} disabled={!clientId}>
                <option value="">— Aucun projet —</option>
                {clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {clientId && clientProjects.length === 0 && (
                <p className="text-xs text-slate-400 italic">Aucun projet actif pour ce client.</p>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── MATÉRIEL COUVERT ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Matériel couvert</p>

            {/* Liste */}
            {materiels.length > 0 && (
              <div className="space-y-2">
                {materiels.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-slate-800">{m.designation}</p>
                      <p className="text-xs text-slate-400">
                        {[m.reference && `Réf: ${m.reference}`, m.numero_serie && `S/N: ${m.numero_serie}`, `Qté: ${m.quantite}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeMateriel(m.id)} className="shrink-0 text-slate-300 hover:text-red-500 transition-colors mt-0.5" aria-label="Supprimer">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire ajout matériel */}
            <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Ajouter un équipement</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <input type="text" value={matDesig} onChange={(e) => setMatDesig(e.target.value)} placeholder="Désignation *" className={inputCls} />
                </div>
                <input type="text" value={matRef}    onChange={(e) => setMatRef(e.target.value)}    placeholder="Référence"     className={inputCls} />
                <input type="text" value={matSerial} onChange={(e) => setMatSerial(e.target.value)} placeholder="N° de série"   className={inputCls} />
                <input type="number" value={matQty}  onChange={(e) => setMatQty(e.target.value)}    placeholder="Qté" min="1"   className={inputCls} />
                <button
                  type="button"
                  onClick={addMateriel}
                  disabled={!matDesig.trim()}
                  className="rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ── NOTES ── */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes</p>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Informations complémentaires, conditions particulières…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <hr className="border-slate-100" />

          {/* ── STATUT & DATES ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Statut & Durée</p>

            <div className="space-y-1.5">
              <label className={labelCls}>Statut du contrat</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(STATUT_META) as ContratStatut[]).map((s) => {
                  const m = STATUT_META[s];
                  return (
                    <button key={s} type="button" onClick={() => setStatut(s)} className={[
                      'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors',
                      statut === s ? `${m.bg} ${m.text} border-current` : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                    ].join(' ')}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Date début</label>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Date fin <span className="text-slate-400 font-normal">(opt.)</span></label>
                <input type="date" value={dateFin}   onChange={(e) => setDateFin(e.target.value)}   className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white shadow-sm p-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le contrat'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
