'use client';

import { useState, useEffect } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import {
  createProduitAction,
  updateProduitAction,
  deleteProduitAction,
  type CatalogueItem,
  type CatalogueInput,
  type CatalogueType,
  type CatalogueUnite,
} from '@/app/actions/catalogue';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: CatalogueType; label: string }[] = [
  { value: 'materiel',    label: 'Matériel'       },
  { value: 'service',     label: 'Service'        },
  { value: 'main_oeuvre', label: "Main d'œuvre"  },
  { value: 'fourniture',  label: 'Fourniture'     },
];

const TVA_OPTIONS = [
  { value: 20,  label: '20 %' },
  { value: 10,  label: '10 %' },
  { value: 5.5, label: '5,5 %' },
  { value: 0,   label: '0 %'  },
];

const UNITE_OPTIONS: { value: CatalogueUnite; label: string }[] = [
  { value: 'u',      label: 'Unité'          },
  { value: 'h',      label: 'Heure'          },
  { value: 'j',      label: 'Jour'           },
  { value: 'ml',     label: 'Mètre linéaire' },
  { value: 'm2',     label: 'm²'             },
  { value: 'kg',     label: 'Kilogramme'     },
  { value: 'forfait',label: 'Forfait'        },
];

const empty: CatalogueInput = {
  ref:         '',
  designation: '',
  description: '',
  type:        'materiel',
  prix_achat:  0,
  prix_vente:  0,
  tva:         20,
  unite:       'u',
  actif:       true,
};

// ─── Styles partagés ──────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const selectCls = inputCls;
const labelCls  = 'block text-sm font-semibold text-slate-700 mb-1.5';

interface CatalogueFormProps {
  open:     boolean;
  onClose:  () => void;
  editing?: CatalogueItem | null;
}

export function CatalogueForm({ open, onClose, editing }: CatalogueFormProps) {
  const [form,    setForm]    = useState<CatalogueInput>(empty);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(false);
  const [confirm, setConfirm] = useState(false);

  // Sync quand editing change
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      ref:         editing.ref         ?? '',
      designation: editing.designation,
      description: editing.description ?? '',
      type:        editing.type,
      prix_achat:  editing.prix_achat,
      prix_vente:  editing.prix_vente,
      tva:         editing.tva,
      unite:       editing.unite,
      actif:       editing.actif,
    } : empty);
    setError('');
    setConfirm(false);
  }, [open, editing]);

  function set<K extends keyof CatalogueInput>(key: K, value: CatalogueInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.designation.trim()) { setError('La désignation est obligatoire.'); return; }
    setSaving(true);
    setError('');
    const res = editing
      ? await updateProduitAction(editing.id, form)
      : await createProduitAction(form);
    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    const res = await deleteProduitAction(editing.id);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier le produit' : 'Nouveau produit / service'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 space-y-4 p-5 overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">
              {error}
            </div>
          )}

          {/* Référence + Désignation */}
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className={labelCls}>Référence</label>
              <input
                value={form.ref}
                onChange={(e) => set('ref', e.target.value)}
                placeholder="REF-001"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Désignation <span className="text-oxi-danger">*</span>
              </label>
              <input
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
                placeholder="Nom du produit ou service"
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Description courte…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Type + Unité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value as CatalogueType)}
                className={selectCls}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unité</label>
              <select
                value={form.unite}
                onChange={(e) => set('unite', e.target.value as CatalogueUnite)}
                className={selectCls}
              >
                {UNITE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prix + TVA */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Prix achat HT (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.prix_achat}
                onChange={(e) => set('prix_achat', parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Prix vente HT (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.prix_vente}
                onChange={(e) => set('prix_vente', parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>TVA</label>
              <select
                value={form.tva}
                onChange={(e) => set('tva', parseFloat(e.target.value))}
                className={selectCls}
              >
                {TVA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Marge calculée */}
          {form.prix_vente > 0 && (
            <div className="rounded-lg bg-white px-4 py-2.5 text-sm">
              <span className="text-slate-500">Marge brute : </span>
              <span className={
                ((form.prix_vente - form.prix_achat) / form.prix_vente * 100) >= 30
                  ? 'font-semibold text-green-600'
                  : ((form.prix_vente - form.prix_achat) / form.prix_vente * 100) >= 15
                    ? 'font-semibold text-orange-500'
                    : 'font-semibold text-red-500'
              }>
                {((form.prix_vente - form.prix_achat) / form.prix_vente * 100).toFixed(1)} %
              </span>
            </div>
          )}

          {/* Actif */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(e) => set('actif', e.target.checked)}
              className="h-4 w-4 rounded border-slate-200 text-blue-600"
            />
            <span className="text-sm font-semibold text-slate-700">Produit actif</span>
          </label>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white shadow-sm p-5 space-y-2">
          {editing && !confirm && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="w-full rounded-lg border border-oxi-danger px-4 py-2.5 text-sm font-medium text-oxi-danger hover:bg-oxi-danger-light transition-colors"
            >
              Supprimer ce produit
            </button>
          )}
          {confirm && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-oxi-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le produit'}
            </button>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
