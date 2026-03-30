'use client';

import { useState, useTransition } from 'react';
import { fmtDate } from '@/lib/format';
import { updateSoldeAction } from '@/app/actions/rh';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SoldeUser {
  user_id:  string;
  user_nom: string;
  cp:       number;
  rtt:      number;
}

export interface Mouvement {
  id:         string;
  user_id:    string;
  user_nom:   string;
  type:       'cp' | 'rtt';
  delta:      number;
  motif:      string;
  created_at: string;
}

interface Props {
  soldes:      SoldeUser[];
  mouvements:  Mouvement[];
  isManager:   boolean;
  userId:      string;
}

// ── Inline Solde Editor ───────────────────────────────────────────────────────

function SoldeCell({
  userId,
  type,
  value,
  editable,
}: {
  userId:   string;
  type:     'cp' | 'rtt';
  value:    number;
  editable: boolean;
}) {
  const [editing, setEditing]     = useState(false);
  const [input,   setInput]       = useState(String(value));
  const [error,   setError]       = useState('');
  const [isPending, startTransition] = useTransition();

  function handleBlur() {
    const n = parseFloat(input);
    if (isNaN(n) || n < 0) { setError('Invalide'); setInput(String(value)); setEditing(false); return; }
    if (n === value) { setEditing(false); return; }
    setError('');
    startTransition(async () => {
      const res = await updateSoldeAction(userId, type, n);
      if (res && 'error' in res && res.error) setError(res.error);
      setEditing(false);
    });
  }

  if (!editable) {
    return (
      <span className={value < 0 ? 'text-oxi-danger font-semibold' : 'font-semibold text-slate-800'}>
        {value}j
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {editing ? (
        <input
          type="number"
          step="0.5"
          min="0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setInput(String(value)); setEditing(false); } }}
          autoFocus
          className="w-20 rounded border border-[#7C3AED] bg-white px-2 py-0.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
        />
      ) : (
        <button
          onClick={() => { setInput(String(value)); setEditing(true); }}
          disabled={isPending}
          className="group flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#EDE9FE] transition-colors"
          title="Modifier le solde"
        >
          <span className={value < 0 ? 'text-oxi-danger font-semibold' : 'font-semibold text-[#7C3AED]'}>
            {value}j
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 text-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
        </button>
      )}
      {error && <p className="text-xs text-oxi-danger mt-0.5">{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Soldes({ soldes, mouvements, isManager, userId }: Props) {
  // Vue employé : soldes propres
  const mySoldes = soldes.find((s) => s.user_id === userId);

  return (
    <div className="space-y-6">
      {/* Vue employé : carte simple */}
      {!isManager && (
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          {[
            { label: 'Congés Payés (CP)', value: mySoldes?.cp  ?? 0 },
            { label: 'RTT',               value: mySoldes?.rtt ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#7C3AED]/20 bg-[#EDE9FE] p-5 text-center">
              <p className={`text-3xl font-bold ${s.value < 0 ? 'text-oxi-danger' : 'text-[#7C3AED]'}`}>
                {s.value}j
              </p>
              <p className="mt-1 text-xs text-[#6D28D9]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Vue manager : tableau de tous les employés */}
      {isManager && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Soldes par employé</h3>
            <p className="text-xs text-slate-400">Cliquez sur un solde pour le modifier</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">Employé</th>
                  <th className="px-4 py-3 font-medium">Solde CP</th>
                  <th className="px-4 py-3 font-medium">Solde RTT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {soldes.map((s) => (
                  <tr key={s.user_id} className="hover:bg-white transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{s.user_nom}</td>
                    <td className="px-4 py-3">
                      <SoldeCell userId={s.user_id} type="cp"  value={s.cp}  editable={isManager} />
                    </td>
                    <td className="px-4 py-3">
                      <SoldeCell userId={s.user_id} type="rtt" value={s.rtt} editable={isManager} />
                    </td>
                  </tr>
                ))}
                {soldes.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">Aucun employé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historique des mouvements */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Historique des mouvements
          <span className="ml-2 text-sm font-normal text-slate-400">({mouvements.length})</span>
        </h3>
        {mouvements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Aucun mouvement enregistré
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  {isManager && <th className="px-4 py-3 font-medium">Employé</th>}
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Variation</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mouvements.map((m) => (
                  <tr key={m.id} className="hover:bg-white transition-colors">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(m.created_at)}</td>
                    {isManager && <td className="px-4 py-3 font-semibold text-slate-700">{m.user_nom}</td>}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                        {m.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${m.delta < 0 ? 'text-oxi-danger' : 'text-oxi-success'}`}>
                        {m.delta > 0 ? '+' : ''}{m.delta}j
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{m.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
