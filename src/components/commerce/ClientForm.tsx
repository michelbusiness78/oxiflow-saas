'use client';

import { useState, useEffect } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createClientAction, updateClientAction, type ClientInput } from '@/app/actions/commerce';

interface Client {
  id:      string;
  nom:     string;
  contact: string;
  email:   string;
  tel:     string;
  adresse: string;
  cp:      string;
  ville:   string;
  notes:   string;
}

interface ClientFormProps {
  open:     boolean;
  onClose:  () => void;
  editing?: Client | null;
}

const empty: ClientInput = {
  nom: '', contact: '', email: '', tel: '',
  adresse: '', cp: '', ville: '', notes: '',
};

function Field({
  label, name, value, onChange, type = 'text', placeholder = '', required = false,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-oxi-text">
        {label}{required && <span className="ml-1 text-oxi-danger">*</span>}
      </label>
      <input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary"
      />
    </div>
  );
}

export function ClientForm({ open, onClose, editing }: ClientFormProps) {
  const [form, setForm]   = useState<ClientInput>(editing ?? empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form quand editing change (useEffect déclenché à chaque changement de editing)
  useEffect(() => { setForm(editing ?? empty); setError(''); }, [editing]);

  function set(key: keyof ClientInput) {
    return (value: string) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    setSaving(true);
    setError('');
    const result = editing
      ? await updateClientAction(editing.id, form)
      : await createClientAction(form);
    setSaving(false);
    if ('error' in result && result.error) { setError(result.error); return; }
    onClose();
    setForm(empty);
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
            <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
              {error}
            </div>
          )}

          <Field label="Nom / Raison sociale" name="nom"     value={form.nom}     onChange={set('nom')}     required placeholder="Dupont SARL" />
          <Field label="Contact"              name="contact" value={form.contact} onChange={set('contact')} placeholder="Jean Dupont" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"    name="email" value={form.email} onChange={set('email')} type="email" placeholder="contact@client.fr" />
            <Field label="Téléphone" name="tel"  value={form.tel}   onChange={set('tel')}   type="tel"   placeholder="06 00 00 00 00" />
          </div>

          <Field label="Adresse" name="adresse" value={form.adresse} onChange={set('adresse')} placeholder="12 rue de la Paix" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" name="cp"    value={form.cp}    onChange={set('cp')}    placeholder="75001" />
            <Field label="Ville"       name="ville" value={form.ville} onChange={set('ville')} placeholder="Paris" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-medium text-oxi-text">Notes</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              rows={3}
              placeholder="Informations complémentaires…"
              className="w-full rounded-lg border border-oxi-border bg-oxi-bg px-3.5 py-2.5 text-sm text-oxi-text placeholder:text-oxi-text-muted outline-none transition-colors focus:border-oxi-primary focus:ring-1 focus:ring-oxi-primary resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 border-t border-oxi-border bg-oxi-surface p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le client'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
