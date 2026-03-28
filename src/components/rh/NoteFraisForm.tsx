'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createNoteFraisAction, uploadJustificatifAction, type NoteFraisInput } from '@/app/actions/rh';
import { todayISO } from '@/lib/format';

const CATEGORIES: { value: NoteFraisInput['categorie']; label: string }[] = [
  { value: 'transport',    label: 'Transport'    },
  { value: 'repas',        label: 'Repas'        },
  { value: 'hebergement',  label: 'Hébergement'  },
  { value: 'fournitures',  label: 'Fournitures'  },
  { value: 'autre',        label: 'Autre'        },
];

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function NoteFraisForm({ open, onClose }: Props) {
  const [date,         setDate]         = useState(todayISO());
  const [montant,      setMontant]      = useState('');
  const [categorie,    setCategorie]    = useState<NoteFraisInput['categorie']>('transport');
  const [description,  setDescription]  = useState('');
  const [file,         setFile]         = useState<File | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState('');
  const [isPending,    startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setMontant('');
      setCategorie('transport');
      setDescription('');
      setFile(null);
      setError('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) { setError('Montant invalide.'); return; }
    setError('');

    startTransition(async () => {
      let justificatif_url: string | null = null;

      if (file) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        const upload = await uploadJustificatifAction(fd);
        setUploading(false);
        if (upload.error) { setError(upload.error); return; }
        justificatif_url = upload.url ?? null;
      }

      const res = await createNoteFraisAction({
        date,
        montant:          montantNum,
        categorie,
        description:      description.trim() || null,
        justificatif_url,
      });

      if (res && 'error' in res && res.error) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  }

  const inputCls = 'w-full rounded-lg border border-oxi-border bg-oxi-bg px-3 py-2 text-sm text-oxi-text focus:outline-none focus:ring-2 focus:ring-[#7C3AED]';
  const isLoading = isPending || uploading;

  return (
    <SlideOver open={open} onClose={onClose} title="Nouvelle note de frais">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">

        {/* Date + Montant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-oxi-text">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-oxi-text">Montant TTC (€) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0.00"
              className={inputCls}
              required
            />
          </div>
        </div>

        {/* Catégorie */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-oxi-text">Catégorie *</label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as NoteFraisInput['categorie'])}
            className={inputCls}
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-oxi-text">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Repas client, billet SNCF Paris-Lyon…"
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* Justificatif */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-oxi-text">Justificatif (photo ou PDF)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-oxi-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDE9FE] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#7C3AED] hover:file:bg-[#DDD6FE] cursor-pointer"
          />
          {file && (
            <p className="text-xs text-oxi-text-muted">{file.name} ({(file.size / 1024).toFixed(0)} Ko)</p>
          )}
        </div>

        {error && <p className="rounded-lg bg-oxi-danger-light px-3 py-2 text-sm text-oxi-danger">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Upload justificatif…' : isPending ? 'Envoi…' : 'Soumettre'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-oxi-border px-4 py-2.5 text-sm text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
