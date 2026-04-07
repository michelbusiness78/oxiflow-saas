// Génération PDF Dossier Technique Client — client-side (jsPDF + autotable)
import type { ClientDossierData } from '@/app/actions/documents';

// ── Couleurs (même charte) ────────────────────────────────────────────────────

const C = {
  navy:      [30,  58,  138] as [number, number, number],
  blue:      [37,  99,  235] as [number, number, number],
  dark:      [15,  23,  42]  as [number, number, number],
  gray:      [100, 116, 139] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight:   [248, 250, 252] as [number, number, number],
  border:    [226, 232, 240] as [number, number, number],
  green:     [22,  163, 74]  as [number, number, number],
  red:       [220, 38,  38]  as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';

const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
};

const fmtStatus = (s: string) => {
  const m: Record<string, string> = {
    planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
  };
  return m[s] ?? s;
};

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise<string | null>((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result as string);
      reader.onerror  = () => res(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── generateClientDossierPDF ──────────────────────────────────────────────────

export async function generateClientDossierPDF(
  dossier:    ClientDossierData,
  clientName: string,
  clientAddr: string,
  company:    { name: string; logoUrl: string | null },
  onProgress: (p: number) => void,
): Promise<void> {
  const { jsPDF }             = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ML  = 20;
  const MR  = 20;
  const CW  = 210 - ML - MR;
  let   y   = 15;

  const lastY     = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const checkPage = (needed = 20) => { if (y + needed > 270) { doc.addPage(); y = 18; } };

  const sectionHeader = (label: string) => {
    checkPage(14);
    doc.setFillColor(...C.navy);
    doc.rect(ML, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.white);
    doc.text(label, ML + 4, y + 4.8);
    y += 10;
  };

  // Logo
  let logoBase64: string | null = null;
  if (company.logoUrl) logoBase64 = await fetchBase64(company.logoUrl);
  onProgress(0.05);

  // ── PAGE DE COUVERTURE ───────────────────────────────────────────────────────

  let logoH = 0;
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', ML, y, 0, 14); logoH = 14; } catch { logoBase64 = null; }
  }
  if (!logoBase64 && company.name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text(company.name, ML, y + 10);
    logoH = 12;
  }
  y += logoH + 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...C.navy);
  doc.text('DOSSIER TECHNIQUE', 105, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...C.blue);
  doc.text(`CLIENT : ${clientName.toUpperCase()}`, 105, y + 4, { align: 'center' });
  y += 14;

  doc.setDrawColor(...C.navy);
  doc.setLineWidth(1.2);
  doc.line(ML, y, 210 - MR, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head:   [],
    body:   [
      ['Client',            clientName],
      ['Adresse',           clientAddr || '—'],
      ['Interventions',     `${dossier.stats.total_interventions}`],
      ['Terminées',         `${dossier.stats.terminees}`],
      ['Matériels installés', `${dossier.stats.total_materiel}`],
      ['Date de génération', fmtDate(new Date().toISOString())],
    ],
    styles:       { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold', textColor: C.gray },
      1: { textColor: C.dark },
    },
    theme:           'plain',
    tableLineColor:  C.border,
    tableLineWidth:  0.1,
  });

  onProgress(0.15);
  doc.addPage();
  y = 18;

  // ── SECTION 1 — Résumé ────────────────────────────────────────────────────────

  sectionHeader('RÉSUMÉ');

  const heures = (dossier.stats.heures_totales / 60).toFixed(1);
  const taux   = dossier.stats.total_interventions > 0
    ? Math.round((dossier.stats.terminees / dossier.stats.total_interventions) * 100)
    : 0;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head:   [['Indicateur', 'Valeur']],
    body:   [
      ['Total interventions',     `${dossier.stats.total_interventions}`],
      ['Interventions terminées', `${dossier.stats.terminees} (${taux} %)`],
      ['Heures totales',          `${heures} h`],
      ['Matériels installés',     `${dossier.stats.total_materiel}`],
      ['Documents techniques',    `${dossier.stats.total_documents}`],
    ],
    styles:             { fontSize: 9, cellPadding: 3 },
    headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 8 },
    alternateRowStyles: { fillColor: C.bgLight },
    theme:              'grid',
  });

  y = lastY() + 10;
  onProgress(0.25);

  // ── SECTION 2 — Tableau récapitulatif ─────────────────────────────────────────

  checkPage(20);
  sectionHeader('TABLEAU RÉCAPITULATIF DES INTERVENTIONS');

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head:   [['Date', 'Titre', 'Technicien', 'Type', 'Durée', 'Statut']],
    body:   dossier.interventions.map((iv) => {
      const dur = iv.timer_elapsed ? fmtDuration(iv.timer_elapsed)
        : (iv.hour_start && iv.hour_end)
        ? fmtDuration(Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000))
        : '—';
      return [
        fmtDate(iv.date_start),
        iv.title,
        iv.tech_name ?? '—',
        iv.type_intervention ?? '—',
        dur,
        fmtStatus(iv.status),
      ];
    }),
    styles:             { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 7 },
    alternateRowStyles: { fillColor: C.bgLight },
    columnStyles:       {
      0: { cellWidth: 26 },
      1: { cellWidth: 48 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: 22 },
    },
    theme: 'grid',
  });

  y = lastY() + 10;
  onProgress(0.40);

  // ── SECTION 3 — Parc matériel ─────────────────────────────────────────────────

  if (dossier.materiel.length > 0) {
    checkPage(20);
    sectionHeader('PARC MATÉRIEL INSTALLÉ');

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head:   [['Désignation', 'Marque', 'Modèle', 'N° Série', 'Localisation', 'Date', 'Technicien']],
      body:   dossier.materiel.map((m) => [
        m.designation ?? '—',
        m.marque      ?? '—',
        m.modele      ?? '—',
        m.serial      ?? '—',
        m.location    ?? '—',
        fmtDate(m.intervention_date),
        m.tech_name   ?? '—',
      ]),
      styles:             { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 6.5 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles:       {
        0: { cellWidth: 34 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 24 },
        4: { cellWidth: 24 },
        5: { cellWidth: 24 },
        6: { cellWidth: 18 },
      },
      theme: 'grid',
    });

    y = lastY() + 10;
  }

  onProgress(0.55);

  // ── SECTION 4 — Détail par intervention ──────────────────────────────────────

  const termineeWithContent = dossier.interventions.filter(
    (iv) => iv.status === 'terminee' && (iv.checklist.length > 0 || iv.observations || iv.materials_installed.length > 0),
  );

  if (termineeWithContent.length > 0) {
    checkPage(20);
    sectionHeader('DÉTAIL DES INTERVENTIONS TERMINÉES');

    for (const iv of termineeWithContent) {
      checkPage(20);

      // Sous-titre intervention
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.blue);
      doc.text(`${iv.title} — ${fmtDate(iv.date_start)}`, ML, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.gray);
      doc.text(
        `Technicien : ${iv.tech_name ?? '—'} · Durée : ${iv.timer_elapsed ? fmtDuration(iv.timer_elapsed) : (iv.hour_start && iv.hour_end ? fmtDuration(Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000)) : '—')} · ${fmtTime(iv.hour_start)} → ${fmtTime(iv.hour_end)}`,
        ML, y,
      );
      y += 5;

      // Checklist
      if (iv.checklist.length > 0) {
        for (const item of iv.checklist) {
          checkPage(6);
          const mark  = item.done ? '✓' : '✗';
          const color = item.done ? C.green : C.red;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...color);
          doc.text(mark, ML + 3, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.dark);
          const lines = doc.splitTextToSize(item.label, CW - 14);
          doc.text(lines as string[], ML + 10, y);
          y += Math.max(5, (lines as string[]).length * 4.5);
        }
      }

      // Observations
      if (iv.observations?.trim()) {
        checkPage(12);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...C.gray);
        const lines  = doc.splitTextToSize(iv.observations, CW - 6);
        const blockH = (lines as string[]).length * 4.5 + 6;
        checkPage(blockH);
        doc.setFillColor(...C.bgLight);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.roundedRect(ML, y, CW, blockH, 1, 1, 'FD');
        doc.text(lines as string[], ML + 4, y + 4.5);
        y += blockH + 4;
      }

      // Matériel de cette intervention
      if (iv.materials_installed.length > 0) {
        checkPage(12);
        autoTable(doc, {
          startY: y,
          margin: { left: ML + 4, right: MR },
          head:   [['Désignation', 'Marque / Modèle', 'N° Série', 'Localisation']],
          body:   iv.materials_installed.map((m) => [
            m.designation ?? '—',
            [m.marque, m.modele].filter(Boolean).join(' ') || '—',
            m.serial   ?? '—',
            m.location ?? '—',
          ]),
          styles:     { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: C.blue, textColor: C.white, fontSize: 6.5 },
          theme:      'grid',
        });
        y = lastY() + 4;
      }

      // Signature
      if (iv.signature_name) {
        checkPage(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.green);
        doc.text(
          `✓ Signé par ${iv.signature_name}${iv.signature_date ? ` le ${fmtDate(iv.signature_date)}` : ''}`,
          ML, y,
        );
        y += 6;
      }

      // Séparateur
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.2);
      doc.line(ML, y, 210 - MR, y);
      y += 6;
    }
  }

  onProgress(0.9);

  // ── PIED DE PAGE ─────────────────────────────────────────────────────────────

  const pageCount  = doc.getNumberOfPages();
  const genDateStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    const footY = 283;
    doc.setDrawColor(...C.navy);
    doc.setLineWidth(0.4);
    doc.line(ML, footY - 4, 210 - MR, footY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text(`OxiFlow — Dossier Technique Confidentiel · ${clientName} · Généré le ${genDateStr}`, ML, footY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.navy);
    doc.text(`Page ${pg} / ${pageCount}`, 210 - MR, footY, { align: 'right' });
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  doc.save(`OxiFlow_DossierTech_${safeName}_${dateStr}.pdf`);
  onProgress(1.0);
}
