'use client';

import { useState, useEffect } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import {
  createClientAction,
  updateClientAction,
  deleteClientAction,
  type ClientInput,
} from '@/app/actions/commerce';

export interface ClientFormClient {
  id:                   string;
  nom:                  string;
  contact:              string;
  email:                string;
  tel:                  string;
  adresse:              string;
  cp:                   string;
  ville:                string;
  siret:                string;
  tva_intra:            string;
  conditions_paiement:  string;
  notes:                string;
  actif:                boolean;
}

interface ClientFormProps {
  open:     boolean;
  onClose:  () => void;
  editing?: ClientFormClient | null;
}

const empty: ClientInput = {
  nom: '', contact: '', email: '', tel: '',
  adresse: '', cp: '', ville: '',
  siret: '', tva_intra: '', conditions_paiement: '',
  notes: '', actif: true,
};

function Field({
  label, name, value, onChange, type = 'text', placeholder = '', required = false,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-semibold text-slate-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

export function ClientForm({ open, onClose, editing }: ClientFormProps) {
  const [form, setForm]           = useState<ClientInput>(editing ?? empty);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  useEffect(() => {
    setForm(editing ?? empty);
    setError('');
    setConfirmDel(false);
  }, [editing]);

  function set(key: keyof ClientInput) {
    return (value: string) => setForm((f) => ({ ...f, [key]: value }));
  }

  // Validation email
  function emailValid(v: string) {
    if (!v) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!emailValid(form.email)) { setError('Format email invalide.'); return; }
    setSaving(true);
    setError('');
    const result = editing
      ? await updateClientAction(editing.id, form)
      : await createClientAction(form);
    setSaving(false);
    if ('error' in result && result.error) { setError(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    const res = await deleteClientAction(editing.id);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); setConfirmDel(false); return; }
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier le client' : 'Nouveau client'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-0">
        <div className="flex-1 space-y-4 p-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Confirmation suppression inline */}
          {confirmDel && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">Supprimer ce client ?</p>
              <p className="text-xs text-red-600">
                Cette action est irréversible. Les devis et factures associés seront conservés.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Suppression…' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          )}

          {/* Section identité */}
          <Field label="Nom / Raison sociale" name="nom"     value={form.nom}     onChange={set('nom')}     required placeholder="Dupont SARL" />
          <Field label="Contact principal"    name="contact" value={form.contact} onChange={set('contact')} placeholder="Jean Dupont" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"     name="email" value={form.email} onChange={set('email')} type="email" placeholder="contact@client.fr" />
            <Field label="Téléphone" name="tel"   value={form.tel}   onChange={set('tel')}   type="tel"   placeholder="06 00 00 00 00" />
          </div>

          {/* Section adresse */}
          <Field label="Adresse" name="adresse" value={form.adresse} onChange={set('adresse')} placeholder="12 rue de la Paix" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" name="cp"    value={form.cp}    onChange={set('cp')}    placeholder="75001" />
            <Field label="Ville"       name="ville" value={form.ville} onChange={set('ville')} placeholder="Paris" />
          </div>

          {/* Section fiscale */}
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Informations fiscales</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SIRET"     name="siret"     value={form.siret}     onChange={set('siret')}     placeholder="12345678901234" />
              <Field label="TVA Intra" name="tva_intra" value={form.tva_intra} onChange={set('tva_intra')} placeholder="FR12345678901" />
            </div>
          </div>

          {/* Conditions de paiement */}
          <Field
            label="Conditions de paiement"
            name="conditions_paiement"
            value={form.conditions_paiement}
            onChange={set('conditions_paiement')}
            placeholder="30 jours fin de mois"
          />

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-semibold text-slate-700">Notes</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              rows={3}
              placeholder="Informations complémentaires…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          {/* Toggle actif */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Client actif</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.actif}
              onClick={() => setForm((f) => ({ ...f, actif: !f.actif }))}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.actif ? 'bg-blue-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.actif ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white shadow-sm p-5">
          {/* Ligne 1 : Annuler + Enregistrer */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le client'}
            </button>
          </div>
          {/* Ligne 2 : Supprimer (seulement en édition) */}
          {editing && !confirmDel && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="mt-3 w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              Supprimer ce client
            </button>
          )}
        </div>
      </form>
    </SlideOver>
  );
}
