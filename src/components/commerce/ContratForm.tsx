'use client';

import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { fmtEur, todayISO } from '@/lib/format';
import { createContratAction, updateContratAction, type ContratInput } from '@/app/actions/contrats';

interface Client { id: string; nom: string; }

export interface Contrat {
  id:              string;
  client_id:       string;
  type:            'maintenance' | 'support' | 'location';
  date_debut:      string;
  date_fin:        string | null;
  montant_mensuel: number | null;
  actif:           boolean;
  created_at:      string;
}

interface ContratFormProps {
  open:     boolean;
  onClose:  () => void;
  clients:  Client[];
  editing?: Contrat | null;
}

const TYPE_LABELS = { maintenance: 'Maintenance', support: 'Support', location: 'Location' };

export function ContratForm({ open, onClose, clients, editing }: ContratFormProps) {
  const today = todayISO();
  const [clientId,   setClientId]   = useState(editing?.client_id        ?? '');
  const [type,       setType]       = useState<ContratInput['type']>(editing?.type ?? 'maintenance');
  const [dateDebut,  setDateDebut]  = useState(editing?.date_debut       ?? today);
  const [dateFin,    setDateFin]    = useState(editing?.date_fin         ?? '');
  const [montant,    setMontant]    = useState(String(editing?.montant_mensuel ?? ''));
  const [actif,      setActif]      = useState(editing?.actif            ?? true);
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    setSaving(true);
    setError('');

    const input: ContratInput = {
      client_id:       clientId,
      type,
      date_debut:      dateDebut,
      date_fin:        dateFin || null,
      montant_mensuel: montant ? parseFloat(montant) : null,
      actif,
    };

    const res = editing
      ? await updateContratAction(editing.id, input)
      : await createContratAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  const inputCls = 'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary';

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? 'Modifier le contrat' : 'Nouveau contrat'}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex-1 space-y-4 p-5">
          {error && <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

          {/* Client */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Client <span className="text-oxi-danger">*</span></label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Type de contrat</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_LABELS) as ContratInput['type'][]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    type === t
                      ? 'border-oxi-primary bg-oxi-primary-light text-oxi-primary'
                      : 'border-oxi-border text-oxi-text-secondary hover:bg-oxi-bg',
                  ].join(' ')}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Date début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-oxi-text">Date fin <span className="text-oxi-text-muted">(optionnel)</span></label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Montant mensuel */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-oxi-text">Montant mensuel (€)</label>
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
              <p className="text-xs text-oxi-text-muted">
                Soit {fmtEur(parseFloat(montant) * 12)} / an
              </p>
            )}
          </div>

          {/* Toggle actif */}
          <div className="flex items-center justify-between rounded-xl border border-oxi-border bg-oxi-bg px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-oxi-text">Contrat actif</p>
              <p className="text-xs text-oxi-text-muted">Le contrat est en vigueur</p>
            </div>
            <button
              type="button"
              onClick={() => setActif((a) => !a)}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                actif ? 'bg-oxi-primary' : 'bg-oxi-border',
              ].join(' ')}
              role="switch"
              aria-checked={actif}
            >
              <span className={[
                'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                actif ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 border-t border-oxi-border bg-oxi-surface p-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-60">
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le contrat'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
