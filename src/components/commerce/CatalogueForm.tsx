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
} from '@/app/actions/catalogue';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: CatalogueType; label: string; color: string }[] = [
  { value: 'materiel',    label: 'Matériel',      color: 'bg-blue-100 text-blue-700 ring-blue-200'   },
  { value: 'service',     label: 'Service',        color: 'bg-purple-100 text-purple-700 ring-purple-200' },
  { value: 'forfait',     label: 'Forfait',        color: 'bg-amber-100 text-amber-700 ring-amber-200'  },
  { value: 'main_oeuvre', label: "Main d'œuvre",  color: 'bg-orange-100 text-orange-700 ring-orange-200' },
  { value: 'fourniture',  label: 'Fourniture',     color: 'bg-slate-100 text-slate-600 ring-slate-200'   },
];

const TVA_OPTIONS = [
  { value: 20,  label: '20 %' },
  { value: 10,  label: '10 %' },
  { value: 5.5, label: '5,5 %' },
  { value: 0,   label: '0 %'  },
];

const UNITE_SUGGESTIONS = [
  'unité', 'heure', 'jour', 'mètre', 'mètre linéaire', 'm²', 'kg', 'forfait', 'lot',
];

const empty: CatalogueInput = {
  ref: '', designation: '', description: '',
  fournisseur: '', categorie: '',
  type: 'materiel', prix_achat: null, prix_vente: 0,
  tva: 20, unite: 'unité', actif: true,
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

// ─── AutoSuggest inline ────────────────────────────────────────────────────────

function AutoSuggest({
  id, value, onChange, suggestions, placeholder,
}: {
  id: string; value: string; onChange: (v: string) => void;
  suggestions: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.toLowerCase();
  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q,
  );

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(s); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Marge ────────────────────────────────────────────────────────────────────

function MargePreview({ achat, vente }: { achat: number | null; vente: number }) {
  if (!vente) return null;
  const montant = achat != null ? vente - achat : null;
  const pct     = achat != null && vente > 0 ? ((vente - achat) / vente) * 100 : null;
  const positive = montant != null ? montant >= 0 : true;

  return (
    <div className={`rounded-lg px-4 py-2.5 text-sm ${positive ? 'bg-green-50' : 'bg-red-50'}`}>
      <span className="text-slate-500">Marge brute : </span>
      <span className={`font-semibold ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {montant != null
          ? `${montant >= 0 ? '+' : ''}${montant.toFixed(2)} €`
          : `${vente.toFixed(2)} €`}
        {pct != null && ` (${pct.toFixed(1)} %)`}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CatalogueFormProps {
  open:          boolean;
  onClose:       () => void;
  editing?:      CatalogueItem | null;
  fournisseurs?: string[];
  categories?:   string[];
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CatalogueForm({
  open, onClose, editing, fournisseurs = [], categories = [],
}: CatalogueFormProps) {
  const [form,    setForm]     = useState<CatalogueInput>(empty);
  const [error,   setError]    = useState('');
  const [saving,  setSaving]   = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [confirm, setConfirm]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      ref:         editing.ref         ?? '',
      designation: editing.designation,
      description: editing.description ?? '',
      fournisseur: editing.fournisseur ?? '',
      categorie:   editing.categorie   ?? '',
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
    if (form.prix_vente < 0) { setError('Le prix de vente doit être positif.'); return; }
    if (form.tva < 0 || form.tva > 100) { setError('La TVA doit être entre 0 et 100.'); return; }
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
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {/* Référence + Désignation */}
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label htmlFor="ref" className={labelCls}>Référence</label>
              <input
                id="ref"
                value={form.ref}
                onChange={(e) => set('ref', e.target.value)}
                placeholder="REF-001"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="designation" className={labelCls}>
                Désignation <span className="text-red-500">*</span>
              </label>
              <input
                id="designation"
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
            <label htmlFor="description" className={labelCls}>Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Description courte…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Fournisseur + Catégorie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fournisseur" className={labelCls}>Fournisseur</label>
              <AutoSuggest
                id="fournisseur"
                value={form.fournisseur}
                onChange={(v) => set('fournisseur', v)}
                suggestions={fournisseurs}
                placeholder="Axis, Hikvision…"
              />
            </div>
            <div>
              <label htmlFor="categorie" className={labelCls}>Catégorie</label>
              <AutoSuggest
                id="categorie"
                value={form.categorie}
                onChange={(v) => set('categorie', v)}
                suggestions={categories}
                placeholder="Caméra, Switch…"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('type', opt.value)}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all',
                    form.type === opt.value
                      ? `${opt.color} ring-2`
                      : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prix + TVA */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="prix_achat" className={labelCls}>P. achat HT (€)</label>
              <input
                id="prix_achat"
                type="number"
                min="0"
                step="0.01"
                value={form.prix_achat ?? ''}
                placeholder="—"
                onChange={(e) =>
                  set('prix_achat', e.target.value === '' ? null : parseFloat(e.target.value) || 0)
                }
                onFocus={(e) => e.target.select()}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="prix_vente" className={labelCls}>P. vente HT (€)</label>
              <input
                id="prix_vente"
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
              <label htmlFor="tva" className={labelCls}>TVA</label>
              <select
                id="tva"
                value={form.tva}
                onChange={(e) => set('tva', parseFloat(e.target.value))}
                className={inputCls}
              >
                {TVA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Marge en temps réel */}
          <MargePreview achat={form.prix_achat} vente={form.prix_vente} />

          {/* Unité (texte libre avec suggestions) */}
          <div>
            <label htmlFor="unite" className={labelCls}>Unité</label>
            <AutoSuggest
              id="unite"
              value={form.unite}
              onChange={(v) => set('unite', v)}
              suggestions={UNITE_SUGGESTIONS}
              placeholder="unité, heure, mètre…"
            />
          </div>

          {/* Actif */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Produit actif</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.actif}
              onClick={() => set('actif', !form.actif)}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.actif ? 'bg-blue-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span className={[
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                form.actif ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white shadow-sm p-5 space-y-2">
          {confirm && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-700">Confirmer la suppression ?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Suppression…' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          )}
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
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le produit'}
            </button>
          </div>
          {editing && !confirm && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              Supprimer ce produit
            </button>
          )}
        </div>
      </form>
    </SlideOver>
  );
}
