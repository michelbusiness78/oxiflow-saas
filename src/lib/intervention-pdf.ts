// Génération PDF rapport d'intervention — côté client uniquement (jsPDF + autotable)
// Appelé via import dynamique depuis InterventionDetailPanel (client component)

import type { PlanningIntervention } from '@/app/actions/technicien';

// Type étendu avec les champs signature (ajoutés au runtime)
export type InterventionWithSignature = PlanningIntervention & {
  signature_data?: string | null;
  signature_name?: string | null;
  signature_date?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(iso));

const fmtTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : 'N/A';

const fmtDuration = (start: string, end: string) => {
  const mins = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));

// ── Couleurs ──────────────────────────────────────────────────────────────────

const C = {
  blue:      [37,  99,  235] as [number, number, number],
  dark:      [15,  23,  42]  as [number, number, number],
  gray:      [100, 116, 139] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight:   [248, 250, 252] as [number, number, number],
  border:    [226, 232, 240] as [number, number, number],
  green:     [22,  163, 74]  as [number, number, number],
  blueLight: [239, 246, 255] as [number, number, number],
};

// ── generateInterventionPDF ───────────────────────────────────────────────────

export async function generateInterventionPDF(
  iv:           InterventionWithSignature,
  companyInfo?: { name?: string; logoUrl?: string | null },
): Promise<Blob> {
  // Import dynamique — browser seulement
  const { jsPDF }            = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 14;            // margin left
  const MR = 14;            // margin right
  const CW = 210 - ML - MR; // content width = 182
  let y  = 14;

  // Accès à la propriété lastAutoTable injectée par autotable
  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const checkPage = (needed = 20) => {
    if (y + needed > 270) { doc.addPage(); y = 14; }
  };

  // ── EN-TÊTE ──────────────────────────────────────────────────────────────────

  const tenantName = companyInfo?.name || '';
  const logoUrl    = companyInfo?.logoUrl ?? null;

  if (logoUrl) {
    try {
      // Le logo est déjà en base64 data URL (converti côté client avant appel)
      doc.addImage(logoUrl, 'PNG', ML, y, 0, 12); // hauteur 12mm, largeur auto
    } catch {
      // image non chargeable — fallback texte
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...C.dark);
      doc.text(tenantName, ML, y + 8);
    }
  } else if (tenantName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.dark);
    doc.text(tenantName, ML, y + 8);
  }

  y += 12;

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.dark);
  doc.text("RAPPORT D'INTERVENTION", ML, y);

  // Date (droite)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(fmtDate(iv.date_start), 210 - MR, y, { align: 'right' });

  y += 6;

  // Ligne bleue
  doc.setDrawColor(...C.blue);
  doc.setLineWidth(0.8);
  doc.line(ML, y, 210 - MR, y);
  y += 7;

  // ── SECTION 1 — Informations générales ──────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('INFORMATIONS GÉNÉRALES', ML, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [],
    body: [
      ['N° Intervention', iv.id.substring(0, 8).toUpperCase()],
      ['Date', fmtDate(iv.date_start)],
      ['Nature', iv.nature === 'sav' ? 'SAV' : 'Projet'],
      ['Technicien', iv.tech_name ?? '—'],
      ['Statut', 'Terminée'],
    ],
    styles:       { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: C.gray }, 1: { cellWidth: CW - 45, textColor: C.dark } },
    theme:           'plain',
    tableLineColor:  C.border,
    tableLineWidth:  0.1,
  });

  y = lastY() + 5;

  // ── SECTION 2 — Client ────────────────────────────────────────────────────

  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('CLIENT', ML, y);
  y += 2;

  const clientNom  = iv.client_name ?? iv.clients?.nom ?? 'N/A';
  const clientAddr = [iv.client_address, iv.client_city].filter(Boolean).join(', ') || 'N/A';
  const clientTel  = iv.client_phone ?? iv.clients?.tel ?? 'N/A';
  const affairNum  = iv.affair_number ?? iv.projects?.affair_number;

  const clientRows: string[][] = [
    ['Société', clientNom],
    ['Adresse', clientAddr],
    ['Téléphone', clientTel],
  ];
  if (affairNum) clientRows.push(['N° Affaire', affairNum]);

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [],
    body: clientRows,
    styles:       { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: C.gray }, 1: { cellWidth: CW - 45, textColor: C.dark } },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.1,
  });

  y = lastY() + 5;

  // ── SECTION 3 — Horaires ─────────────────────────────────────────────────

  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('HORAIRES', ML, y);
  y += 2;

  const actualMins = (iv.hour_start && iv.hour_end)
    ? Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000)
    : null;
  const depassMin = (iv.hours_planned != null && actualMins != null)
    ? Math.round(actualMins - iv.hours_planned * 60)
    : null;

  const horairesRows: string[][] = [
    ['Début',         fmtTime(iv.hour_start)],
    ['Fin',           fmtTime(iv.hour_end)],
    ['Durée réelle',  iv.hour_start && iv.hour_end ? fmtDuration(iv.hour_start, iv.hour_end) : 'N/A'],
    ['Heures prévues', iv.hours_planned != null ? `${iv.hours_planned}h` : 'N/A'],
  ];

  if (depassMin != null && depassMin > 0) {
    const d = depassMin >= 60
      ? `+${Math.floor(depassMin / 60)}h${(depassMin % 60).toString().padStart(2, '0')} (dépassement)`
      : `+${depassMin}min (dépassement)`;
    horairesRows.push(['Écart', d]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [],
    body: horairesRows,
    styles:       { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: C.gray }, 1: { cellWidth: CW - 45, textColor: C.dark } },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.1,
  });

  y = lastY() + 5;

  // ── SECTION 4 — Matériel installé ────────────────────────────────────────

  checkPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('MATÉRIEL INSTALLÉ', ML, y);
  y += 2;

  const materials = iv.materials_installed ?? [];

  if (materials.length === 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: [['', 'Aucun matériel renseigné']],
      styles:       { fontSize: 9, cellPadding: 3, textColor: C.lightGray, fontStyle: 'italic' },
      columnStyles: { 0: { cellWidth: 45 } },
      theme: 'plain',
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head:   [['Désignation', 'Référence', 'Marque', 'Modèle', 'N° Série']],
      body:   materials.map((m) => [
        m.designation || [m.marque, m.modele].filter(Boolean).join(' ') || '—',
        m.reference || '—',
        m.marque    || '—',
        m.modele    || '—',
        m.serial    || '—',
      ]),
      styles:             { fontSize: 8, cellPadding: 2 },
      headStyles:         { fillColor: C.blueLight, textColor: C.blue, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: C.bgLight },
      theme: 'striped',
    });
  }

  y = lastY() + 5;

  // ── SECTION 5 — Checklist ────────────────────────────────────────────────

  const checklist = iv.checklist ?? [];

  if (checklist.length > 0) {
    checkPage(checklist.length * 5 + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.blue);
    const checkDone = checklist.filter((c) => c.done).length;
    doc.text(`CHECKLIST (${checkDone}/${checklist.length} réalisées)`, ML, y);
    y += 5;

    for (const item of checklist) {
      checkPage(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (item.done) {
        doc.setTextColor(...C.green);
        doc.text('✓', ML + 1, y);
      } else {
        doc.setTextColor(...C.lightGray);
        doc.text('○', ML + 1, y);
      }
      doc.setTextColor(...C.dark);
      doc.text(item.label, ML + 7, y);
      y += 5;
    }
    y += 3;
  }

  // ── SECTION 6 — Observations ─────────────────────────────────────────────

  checkPage(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('OBSERVATIONS', ML, y);
  y += 4;

  const obsText  = iv.observations?.trim() || 'Aucune observation';
  const obsLines = doc.splitTextToSize(obsText, CW - 6);
  const obsH     = obsLines.length * 5 + 6;

  checkPage(obsH + 5);
  doc.setFillColor(...C.bgLight);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, obsH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(obsText === 'Aucune observation' ? C.lightGray[0] : C.dark[0], C.dark[1], C.dark[2]);
  doc.text(obsLines, ML + 3, y + 5);
  y += obsH + 6;

  // ── SECTION 7 — Signature client ─────────────────────────────────────────

  checkPage(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('SIGNATURE CLIENT', ML, y);
  y += 5;

  const sigData = iv.signature_data;
  const sigName = iv.signature_name;
  const sigDate = iv.signature_date;

  if (sigData) {
    try {
      doc.addImage(sigData, 'PNG', ML, y, 80, 22);
      y += 25;
    } catch {
      // image non chargeable — on passe
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    const sigLine = `Signé par ${sigName ?? 'Client'}${sigDate ? ` le ${fmtDateTime(sigDate)}` : ''}`;
    doc.text(sigLine, ML, y);
    y += 5;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.lightGray);
    doc.text('Non signé', ML, y);
    y += 5;
  }

  // ── PIED DE PAGE (toutes les pages) ──────────────────────────────────────

  const pageCount  = doc.getNumberOfPages();
  const genDateStr = fmtDateTime(new Date().toISOString());

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footY = 285;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(ML, footY - 4, 210 - MR, footY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.lightGray);
    doc.text(`Rapport généré automatiquement par OxiFlow — ${genDateStr}`, ML, footY);
    doc.text("Ce document constitue un justificatif d'intervention", ML, footY + 3.5);
    doc.text(`Page ${i}/${pageCount}`, 210 - MR, footY, { align: 'right' });
  }

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}
