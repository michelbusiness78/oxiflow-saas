'use client';

import { useState } from 'react';
import type { jsPDF as JsPDFInstance } from 'jspdf';
import type { ChecklistItem, MaterielItem } from '@/app/actions/interventions';

interface InterventionForPDF {
  id:            string;
  date:          string;
  type:          string;
  statut:        string;
  duree_minutes: number | null;
  notes:         string | null;
  adresse:       string | null;
  checklist:     ChecklistItem[];
  materiel:      MaterielItem[];
  photos:        string[];
  signature_url: string | null;
  client_nom:    string;
  technicien_nom:string;
}

interface RapportPDFProps {
  intervention: InterventionForPDF;
  companyName?: string;
}

const TYPE_LABELS: Record<string, string> = {
  installation: 'Installation',
  maintenance:  'Maintenance',
  sav:          'SAV',
  depannage:    'Dépannage',
};

function fmtDuree(minutes: number | null): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function RapportPDF({ intervention, companyName = 'OxiFlow' }: RapportPDFProps) {
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const NAVY  = [15, 23, 42] as [number, number, number];
      const BLUE  = [56, 131, 244] as [number, number, number];
      let y = 0;

      // ── Header navy ──
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 14, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Rapport d\'intervention', 14, 20);
      doc.text(new Date(intervention.date).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }), pageW - 14, 20, { align: 'right' });
      y = 38;

      // ── Infos principales ──
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Informations', 14, y);
      y += 6;

      const infos = [
        ['Client',       intervention.client_nom],
        ['Type',         TYPE_LABELS[intervention.type] ?? intervention.type],
        ['Technicien',   intervention.technicien_nom],
        ['Durée',        fmtDuree(intervention.duree_minutes)],
        ['Adresse',      intervention.adresse ?? '—'],
      ];

      autoTable(doc, {
        startY: y,
        head:   [],
        body:   infos,
        theme:  'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, textColor: [80, 80, 80] },
          1: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as JsPDFInstance & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // ── Checklist ──
      if (intervention.checklist.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Checklist', 14, y);
        y += 5;

        autoTable(doc, {
          startY: y,
          head:   [['', 'Étape']],
          body:   intervention.checklist.map((item) => [
            item.done ? '✓' : '○',
            item.label,
          ]),
          theme:  'striped',
          styles: { fontSize: 9 },
          headStyles: { fillColor: NAVY, fontSize: 9 },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as unknown as JsPDFInstance & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // ── Matériel ──
      if (intervention.materiel.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Matériel utilisé', 14, y);
        y += 5;

        autoTable(doc, {
          startY: y,
          head:   [['Désignation', 'Référence', 'Qté']],
          body:   intervention.materiel.map((m) => [
            m.designation,
            m.reference ?? '—',
            String(m.quantite),
          ]),
          theme:  'striped',
          styles: { fontSize: 9 },
          headStyles: { fillColor: NAVY, fontSize: 9 },
          columnStyles: { 2: { halign: 'center', cellWidth: 15 } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as unknown as JsPDFInstance & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // ── Notes ──
      if (intervention.notes) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Notes', 14, y);
        y += 5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(intervention.notes, pageW - 28);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 8;
      }

      // ── Photos miniatures ──
      if (intervention.photos.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`Photos (${intervention.photos.length})`, 14, y);
        y += 5;

        const photoDataUrls = await Promise.all(
          intervention.photos.slice(0, 6).map(fetchImageAsDataUrl),
        );

        const imgW  = 55;
        const imgH  = 42;
        const gap   = 5;
        let col     = 0;
        const rowY  = y;

        for (const dataUrl of photoDataUrls) {
          if (!dataUrl) continue;
          const x = 14 + col * (imgW + gap);
          if (col === 0 && rowY + imgH > 270) {
            doc.addPage();
            y = 20;
          }
          doc.addImage(dataUrl, 'JPEG', x, col === 0 ? y : rowY, imgW, imgH);
          col++;
          if (col >= 3) { col = 0; y = rowY + imgH + gap; }
        }
        if (col > 0) y = rowY + imgH + 8;
        else y += 8;
      }

      // ── Signature ──
      if (intervention.signature_url) {
        const sigData = await fetchImageAsDataUrl(intervention.signature_url);
        if (sigData) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Signature client', 14, y);
          y += 5;
          doc.addImage(sigData, 'PNG', 14, y, 80, 27);
          y += 35;
        }
      }

      // ── Footer ──
      const pageCount = (doc as unknown as JsPDFInstance & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...BLUE);
        doc.rect(0, 287, pageW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`Rapport généré par ${companyName}`, 14, 293);
        doc.text(`Page ${i}/${pageCount}`, pageW - 14, 293, { align: 'right' });
      }

      const date = new Date(intervention.date).toISOString().split('T')[0];
      doc.save(`rapport-intervention-${date}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-oxi-border bg-oxi-surface py-4 text-sm font-semibold text-oxi-text hover:bg-oxi-bg transition-colors disabled:opacity-60"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5 text-oxi-primary" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
      {loading ? 'Génération du rapport…' : 'Générer le rapport PDF'}
    </button>
  );
}
