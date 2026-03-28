// Génération PDF côté client via jsPDF + jspdf-autotable
// Import dynamique pour éviter les erreurs SSR

import { fmtEur, fmtDate } from './format';
import type { DevisLigne } from '@/app/actions/commerce';

export interface PDFDocument {
  type:        'devis' | 'facture';
  num:         string;
  date:        string;
  validite?:   string; // devis seulement
  echeance?:   string; // facture seulement
  client:      { nom: string; adresse?: string; cp?: string; ville?: string; email?: string; tel?: string };
  societe:     { nom: string; adresse?: string; email?: string; tel?: string; siret?: string; tva_intra?: string };
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
  mentions?:   string;
}

export async function generatePDF(doc: PDFDocument): Promise<void> {
  // Import dynamique — évite SSR et garde le bundle serveur léger
  const { jsPDF }   = await import('jspdf');
  const autoTable   = (await import('jspdf-autotable')).default;

  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W      = 210; // A4 largeur mm
  const margin = 15;
  const navy   = [27, 42, 74]  as [number, number, number]; // #1B2A4A
  const primary= [37, 99, 235] as [number, number, number]; // #2563EB
  const gray   = [100, 116, 139] as [number, number, number];

  // ── En-tête société ──────────────────────────────────────────────────────
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, W, 30, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(doc.societe.nom, margin, 13);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(200, 210, 230);
  const societeInfo = [
    doc.societe.adresse,
    doc.societe.email,
    doc.societe.tel,
    doc.societe.siret ? `SIRET : ${doc.societe.siret}` : null,
    doc.societe.tva_intra ? `TVA : ${doc.societe.tva_intra}` : null,
  ].filter(Boolean).join('  |  ');
  pdf.text(societeInfo, margin, 21);

  // Type + numéro
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...navy);
  const typeLabel = doc.type === 'devis' ? 'DEVIS' : 'FACTURE';
  pdf.text(`${typeLabel} N° ${doc.num}`, margin, 42);

  // ── Infos document (date, validité/échéance) ──────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...gray);
  let infoY = 50;
  pdf.text(`Date : ${fmtDate(doc.date)}`, margin, infoY);
  if (doc.type === 'devis' && doc.validite) {
    pdf.text(`Validité : ${fmtDate(doc.validite)}`, margin, infoY + 5);
  }
  if (doc.type === 'facture' && doc.echeance) {
    pdf.text(`Échéance : ${fmtDate(doc.echeance)}`, margin, infoY + 5);
  }

  // ── Bloc client ───────────────────────────────────────────────────────────
  const clientX = W - margin - 70;
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(clientX - 4, 36, 74, 30, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...navy);
  pdf.text('FACTURER À', clientX, 43);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(doc.client.nom, clientX, 50);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...gray);
  const clientLines = [
    doc.client.adresse,
    [doc.client.cp, doc.client.ville].filter(Boolean).join(' '),
    doc.client.email,
    doc.client.tel,
  ].filter(Boolean) as string[];
  clientLines.forEach((line, i) => pdf.text(line, clientX, 56 + i * 4));

  // ── Tableau des lignes ────────────────────────────────────────────────────
  const tableStartY = 75;

  autoTable(pdf, {
    startY:  tableStartY,
    margin:  { left: margin, right: margin },
    head: [['Désignation', 'Qté', 'PU HT', 'Remise', 'TVA', 'Sous-total HT']],
    body: doc.lignes.map((l) => {
      const ht = l.quantite * l.prix_ht * (1 - l.remise_pct / 100);
      return [
        l.designation,
        l.quantite.toString(),
        fmtEur(l.prix_ht),
        l.remise_pct > 0 ? `${l.remise_pct}%` : '—',
        `${l.tva_pct}%`,
        fmtEur(ht),
      ];
    }),
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontSize:  8,
      fontStyle: 'bold',
    },
    bodyStyles:  { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 15 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 30 },
    },
  });

  // ── Totaux ────────────────────────────────────────────────────────────────
  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const totalsX = W - margin - 65;

  pdf.setFontSize(9);

  const rows: [string, string][] = [
    ['Total HT',  fmtEur(doc.montant_ht)],
    ['TVA',       fmtEur(doc.tva)],
  ];
  rows.forEach(([label, value], i) => {
    pdf.setTextColor(...gray);
    pdf.text(label, totalsX, finalY + i * 6);
    pdf.setTextColor(30, 41, 59);
    pdf.text(value, W - margin, finalY + i * 6, { align: 'right' });
  });

  // Ligne TTC
  const ttcY = finalY + rows.length * 6 + 2;
  pdf.setFillColor(...primary);
  pdf.rect(totalsX - 4, ttcY - 4, W - margin - totalsX + 4, 9, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text('TOTAL TTC', totalsX, ttcY + 1);
  pdf.text(fmtEur(doc.montant_ttc), W - margin, ttcY + 1, { align: 'right' });

  // ── Mentions légales ──────────────────────────────────────────────────────
  if (doc.mentions) {
    const mentionsY = Math.max(ttcY + 20, 250);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...gray);
    pdf.text(doc.mentions, margin, mentionsY, { maxWidth: W - margin * 2 });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  pdf.setFillColor(...navy);
  pdf.rect(0, 285, W, 12, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(200, 210, 230);
  pdf.text(doc.societe.nom, margin, 293);
  const pageNum = `Page 1 / 1`;
  pdf.text(pageNum, W - margin, 293, { align: 'right' });

  // ── Téléchargement ────────────────────────────────────────────────────────
  const filename = `${typeLabel.toLowerCase()}-${doc.num}.pdf`;
  pdf.save(filename);
}
