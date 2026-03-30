'use client';

import { fmtDate } from '@/lib/format';

interface FactureCSV {
  num:         string;
  date:        string;
  echeance:    string;
  client_nom?: string;
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
  statut:      string;
}

interface ExportCSVProps {
  factures: FactureCSV[];
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee:   'Envoyée',
  payee:     'Payée',
  partielle: 'Partielle',
  impayee:   'Impayée',
};

export function ExportCSV({ factures }: ExportCSVProps) {
  function download() {
    const headers = [
      'Date',
      'Numéro',
      'Client',
      'Montant HT (€)',
      'TVA (€)',
      'Montant TTC (€)',
      'Statut',
      'Échéance',
    ];

    const rows = factures.map((f) => [
      fmtDate(f.date),
      f.num,
      f.client_nom ?? '—',
      f.montant_ht.toFixed(2).replace('.', ','),
      f.tva.toFixed(2).replace('.', ','),
      f.montant_ttc.toFixed(2).replace('.', ','),
      STATUT_LABELS[f.statut] ?? f.statut,
      f.echeance ? fmtDate(f.echeance) : '',
    ]);

    // Encodage UTF-8 avec BOM pour Excel
    const BOM = '\uFEFF';
    const csv = BOM + [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'),
      )
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `factures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
      title="Exporter les factures en CSV"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Exporter CSV
    </button>
  );
}
