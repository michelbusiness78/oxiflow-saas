'use client';

import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createSAVAction, updateSAVAction, type SAVInput } from '@/app/actions/sav';

interface Client  { id: string; nom: string; }
interface Contrat { id: string; client_id: string; type: string; actif: boolean; }
interface User    { id: string; nom: string; prenom: string; }

export interface SAVTicket {
  id:              string;
  client_id:       string;
  titre:           string | null;
  description:     string;
  priorite:        'faible' | 'normale' | 'haute' | 'urgente';
  statut:          'ouvert' | 'en_cours' | 'resolu' | 'cloture';
  contrat_id:      string | null;
  assigne_a:       string | null;
  date_ouverture:  string;
  date_resolution: string | null;
  created_at:      string;
}

interface SAVFormProps {
  open:     boolean;
  onClose:  () => void;
  clients:  Client[];
  contrats: Contrat[];
  users:    User[];
  editing?: SAVTicket | null;
}

const PRIORITES: { value: SAVInput['priorite']; label: string; color: string }[] = [
  { value: 'faible',   label: 'Faible',   color: 'border-oxi-border text-oxi-text-secondary' },
  { value: 'normale',  label: 'Normale',  color: 'border-blue-300 text-blue-600'             },
  { value: 'haute',    label: 'Haute',    color: 'border-yellow-400 text-yellow-600'          },
  { value: 'urgente',  label: 'Urgente',  color: 'border-red-400 text-red-600'               },
];

const STATUTS: { value: SAVInput['statut']; label: string }[] = [
  { value: 'ouvert',   label: 'Ouvert'   },
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolu',   label: 'Résolu'   },
  { value: 'cloture',  label: 'Clôturé'  },
];

const inputCls = 'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

export function SAVForm({ open, onClose, clients, contrats, users, editing }: SAVFormProps) {
  const [clientId,    setClientId]    = useState(editing?.client_id       ?? '');
  const [titre,       setTitre]       = useState(editing?.titre           ?? '');
  const [desc,        setDesc]        = useState(editing?.description     ?? '');
  const [priorite,    setPriorite]    = useState<SAVInput['priorite']>(editing?.priorite ?? 'normale');
  const [statut,      setStatut]      = useState<SAVInput['statut']>(editing?.statut ?? 'ouvert');
  const [contratId,   setContratId]   = useState(editing?.contrat_id      ?? '');
  const [assigneA,    setAssigneA]    = useState(editing?.assigne_a       ?? '');
  const [resolution,  setResolution]  = useState(editing?.date_resolution ? editing.date_resolution.split('T')[0] : '');
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const filteredContrats = contrats.filter((c) => !clientId || c.client_id === clientId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    if (!titre.trim()) { setError('Le titre est requis.'); return; }
    if (!desc.trim())  { setError('La description est requise.'); return; }

    setSaving(true);
    setError('');

    const input: SAVInput = {
      client_id:       clientId,
      titre:           titre.trim(),
      description:     desc.trim(),
      priorite,
      statut,
      contrat_id:      contratId  || null,
      assigne_a:       assigneA   || null,
      date_resolution: resolution || null,
    };

    const res = editing
      ? await updateSAVAction(editing.id, input)
      : await createSAVAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? 'Modifier le ticket SAV' : 'Nouveau ticket SAV'}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex-1 space-y-4 p-5">
          {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

          {/* Client */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Client <span className="text-oxi-danger">*</span></label>
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setContratId(''); }} className={inputCls}>
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {/* Contrat lié + badge */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Contrat associé</label>
            <select value={contratId} onChange={(e) => setContratId(e.target.value)} className={inputCls}>
              <option value="">— Hors contrat —</option>
              {filteredContrats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type.charAt(0).toUpperCase() + c.type.slice(1)}{!c.actif ? ' (inactif)' : ''}
                </option>
              ))}
            </select>
            {clientId && (
              <p className={`text-xs font-medium ${contratId ? 'text-oxi-success' : 'text-oxi-text-muted'}`}>
                {contratId ? '✓ Sous contrat' : 'Hors contrat'}
              </p>
            )}
          </div>

          {/* Titre */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Titre <span className="text-oxi-danger">*</span></label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Imprimante ne répond plus" className={inputCls} required />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Description <span className="text-oxi-danger">*</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Décrivez le problème…" className={`${inputCls} resize-none`} required />
          </div>

          {/* Priorité */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Priorité</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriorite(p.value)}
                  className={[
                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    priorite === p.value
                      ? 'border-oxi-primary bg-oxi-primary-light text-oxi-primary'
                      : `${p.color} hover:bg-oxi-bg`,
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Statut</label>
            <select value={statut} onChange={(e) => setStatut(e.target.value as SAVInput['statut'])} className={inputCls}>
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Technicien */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Technicien assigné</label>
            <select value={assigneA} onChange={(e) => setAssigneA(e.target.value)} className={inputCls}>
              <option value="">— Non assigné —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
            </select>
          </div>

          {/* Date résolution */}
          {(statut === 'resolu' || statut === 'cloture') && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Date de résolution</label>
              <input type="date" value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-oxi-border bg-oxi-surface p-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le ticket'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
