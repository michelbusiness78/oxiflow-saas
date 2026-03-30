'use client';

import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO } from '@/lib/format';
import { createProjetAction, updateProjetAction, type ProjetInput } from '@/app/actions/projets';

interface Client { id: string; nom: string; }
interface Devis  { id: string; num: string; client_id: string; }
interface User   { id: string; nom: string; prenom: string; }

export interface Dossier {
  id:              string;
  client_id:       string;
  nom:             string;
  type_projet:     string | null;
  statut:          string;
  date_debut:      string | null;
  date_fin_prevue: string | null;
  pct_avancement:  number;
  montant_ht:      number | null;
  devis_id:        string | null;
  facture_id:      string | null;
  chef_projet_id:  string | null;
  created_at:      string;
}

interface DossierFormProps {
  open:     boolean;
  onClose:  () => void;
  clients:  Client[];
  devisList:Devis[];
  users:    User[];
  editing?: Dossier | null;
}

const STATUTS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours',   label: 'En cours'   },
  { value: 'termine',    label: 'Terminé'    },
  { value: 'annule',     label: 'Annulé'     },
];

const TYPES = ['Développement', 'Intégration', 'Formation', 'Conseil', 'Maintenance', 'Autre'];

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

export function DossierForm({ open, onClose, clients, devisList, users, editing }: DossierFormProps) {
  const today = todayISO();

  const [clientId,    setClientId]    = useState(editing?.client_id       ?? '');
  const [nom,         setNom]         = useState(editing?.nom              ?? '');
  const [typeProjet,  setTypeProjet]  = useState(editing?.type_projet      ?? '');
  const [statut,      setStatut]      = useState(editing?.statut           ?? 'en_attente');
  const [dateDebut,   setDateDebut]   = useState(editing?.date_debut       ?? today);
  const [dateFin,     setDateFin]     = useState(editing?.date_fin_prevue  ?? '');
  const [pct,         setPct]         = useState(String(editing?.pct_avancement ?? 0));
  const [montant,     setMontant]     = useState(String(editing?.montant_ht ?? ''));
  const [devisId,     setDevisId]     = useState(editing?.devis_id         ?? '');
  const [chefId,      setChefId]      = useState(editing?.chef_projet_id   ?? '');
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const filteredDevis = devisList.filter((d) => !clientId || d.client_id === clientId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    if (!nom.trim()) { setError('Le nom du projet est requis.'); return; }

    setSaving(true);
    setError('');

    const input: ProjetInput = {
      client_id:       clientId,
      nom:             nom.trim(),
      type_projet:     typeProjet || null,
      statut,
      date_debut:      dateDebut || null,
      date_fin_prevue: dateFin   || null,
      pct_avancement:  parseInt(pct) || 0,
      montant_ht:      montant ? parseFloat(montant) : null,
      devis_id:        devisId  || null,
      facture_id:      editing?.facture_id ?? null,
      chef_projet_id:  chefId   || null,
    };

    const res = editing
      ? await updateProjetAction(editing.id, input)
      : await createProjetAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  const pctNum = Math.max(0, Math.min(100, parseInt(pct) || 0));

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? 'Modifier le dossier' : 'Nouveau dossier'}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex-1 space-y-4 p-5">
          {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

          {/* Client */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Client <span className="text-oxi-danger">*</span></label>
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setDevisId(''); }} className={inputCls}>
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {/* Nom */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nom du projet <span className="text-oxi-danger">*</span></label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Refonte site web" className={inputCls} required />
          </div>

          {/* Type + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Type</label>
              <select value={typeProjet} onChange={(e) => setTypeProjet(e.target.value)} className={inputCls}>
                <option value="">— Choisir —</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Statut</label>
              <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inputCls}>
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Date début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Date fin prévue</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Avancement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">Avancement</label>
              <span className="text-sm font-semibold text-blue-600">{pctNum}%</span>
            </div>
            <input
              type="range"
              value={pctNum}
              onChange={(e) => setPct(e.target.value)}
              min="0"
              max="100"
              step="5"
              className="w-full accent-blue-600"
            />
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${pctNum}%` }}
              />
            </div>
          </div>

          {/* Montant */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Montant HT prévu (€)</label>
            <input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={inputCls}
            />
            {montant && !isNaN(parseFloat(montant)) && (
              <p className="text-xs text-slate-400">= {fmtEur(parseFloat(montant))}</p>
            )}
          </div>

          {/* Devis lié */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Devis associé <span className="text-slate-400">(optionnel)</span></label>
            <select value={devisId} onChange={(e) => setDevisId(e.target.value)} className={inputCls}>
              <option value="">— Aucun devis —</option>
              {filteredDevis.map((d) => <option key={d.id} value={d.id}>{d.num}</option>)}
            </select>
          </div>

          {/* Chef de projet */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Chef de projet</label>
            <select value={chefId} onChange={(e) => setChefId(e.target.value)} className={inputCls}>
              <option value="">— Non assigné —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white shadow-sm p-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le dossier'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
