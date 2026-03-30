'use client';

import { useState, useTransition, useEffect } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { createCongeAction, type CongeInput } from '@/app/actions/rh';
import { todayISO } from '@/lib/format';

// ── Helpers ───────────────────────────────────────────────────────────────────

function countJoursOuvres(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const start = new Date(debut + 'T00:00:00');
  const end   = new Date(fin   + 'T00:00:00');
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

const TYPES: { value: CongeInput['type']; label: string }[] = [
  { value: 'cp',          label: 'Congés payés (CP)'  },
  { value: 'rtt',         label: 'RTT'                },
  { value: 'maladie',     label: 'Maladie'            },
  { value: 'sans_solde',  label: 'Sans solde'         },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function CongeForm({ open, onClose }: Props) {
  const [type,        setType]        = useState<CongeInput['type']>('cp');
  const [dateDebut,   setDateDebut]   = useState(todayISO());
  const [dateFin,     setDateFin]     = useState(todayISO());
  const [commentaire, setCommentaire] = useState('');
  const [error,       setError]       = useState('');
  const [isPending,   startTransition] = useTransition();

  const nbJours = countJoursOuvres(dateDebut, dateFin);

  // Reset on open
  useEffect(() => {
    if (open) {
      setType('cp');
      setDateDebut(todayISO());
      setDateFin(todayISO());
      setCommentaire('');
      setError('');
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nbJours <= 0) { setError('La date de fin doit être après la date de début.'); return; }
    setError('');

    startTransition(async () => {
      const res = await createCongeAction({
        type,
        date_debut:  dateDebut,
        date_fin:    dateFin,
        nb_jours:    nbJours,
        commentaire: commentaire.trim() || null,
      });
      if (res && 'error' in res && res.error) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]';

  return (
    <SlideOver open={open} onClose={onClose} title="Demande de congé">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Type de congé *</label>
          <select value={type} onChange={(e) => setType(e.target.value as CongeInput['type'])} className={inputCls}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Date début *</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => { setDateDebut(e.target.value); if (e.target.value > dateFin) setDateFin(e.target.value); }}
              className={inputCls}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Date fin *</label>
            <input
              type="date"
              value={dateFin}
              min={dateDebut}
              onChange={(e) => setDateFin(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>

        {/* Calcul jours */}
        <div className="rounded-lg bg-[#EDE9FE] px-4 py-3 text-sm">
          <span className="text-[#6D28D9]">
            {nbJours > 0
              ? <><span className="font-semibold text-[#7C3AED]">{nbJours}</span> jour{nbJours > 1 ? 's' : ''} ouvré{nbJours > 1 ? 's' : ''}</>
              : <span className="text-slate-400">Sélectionnez une période valide</span>
            }
          </span>
        </div>

        {/* Commentaire */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Commentaire</label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            placeholder="Motif, précisions…"
            className={inputCls + ' resize-none'}
          />
        </div>

        {error && <p className="rounded-lg bg-oxi-danger-light px-3 py-2 text-sm text-oxi-danger">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending || nbJours <= 0}
            className="flex-1 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Envoi en cours…' : 'Soumettre la demande'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-white transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
