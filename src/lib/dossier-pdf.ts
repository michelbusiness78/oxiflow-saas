// Génération PDF Dossier Technique — client-side (jsPDF + autotable)
// Import dynamique depuis TechnicienDossier

import type { PlanningIntervention } from '@/app/actions/technicien';

export type PeriodFilter = 'today' | '7j' | '30j' | 'all';

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: "Aujourd'hui",
  '7j':  '7 derniers jours',
  '30j': '30 derniers jours',
  all:   'Toutes les interventions',
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
  const map: Record<string, string> = {
    planifiee: 'Planifiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
  };
  return map[s] ?? s;
};

const ivDuration = (i: PlanningIntervention): string => {
  if (i.timer_elapsed) return fmtDuration(i.timer_elapsed);
  if (i.hour_start && i.hour_end) {
    const mins = Math.floor((new Date(i.hour_end).getTime() - new Date(i.hour_start).getTime()) / 60000);
    return fmtDuration(mins);
  }
  return '—';
};

// ── Couleurs (même charte que les autres PDF) ─────────────────────────────────

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

// Charge une URL image en base64 data URL
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

// ── generateDossierPDF ────────────────────────────────────────────────────────

export async function generateDossierPDF(
  interventions: PlanningIntervention[],
  techName:      string,
  period:        PeriodFilter,
  sections:      Record<string, boolean>,
  company:       { name: string; logoUrl: string | null },
  onProgress:    (p: number) => void,
): Promise<void> {
  const { jsPDF }             = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ML   = 20;
  const MR   = 20;
  const CW   = 210 - ML - MR; // 170mm
  let   y    = 15;

  const lastY   = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const checkPage = (needed = 20) => { if (y + needed > 270) { doc.addPage(); y = 18; } };

  // ── Titre de section ─────────────────────────────────────────────────────────
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

  // ── Logo ─────────────────────────────────────────────────────────────────────
  let logoBase64: string | null = null;
  if (company.logoUrl) {
    logoBase64 = await fetchBase64(company.logoUrl);
  }
  onProgress(0.08);

  // ── PAGE DE COUVERTURE ───────────────────────────────────────────────────────

  // Logo / nom société
  let logoH = 0;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', ML, y, 0, 14);
      logoH = 14;
    } catch {
      logoBase64 = null;
    }
  }
  if (!logoBase64 && company.name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text(company.name, ML, y + 10);
    logoH = 12;
  }
  y += logoH + 18;

  // Grand titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...C.navy);
  doc.text('DOSSIER TECHNIQUE', 105, y, { align: 'center' });
  y += 12;

  // Ligne déco
  doc.setDrawColor(...C.navy);
  doc.setLineWidth(1.2);
  doc.line(ML, y, 210 - MR, y);
  y += 14;

  // Infos de couverture
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head:   [],
    body:   [
      ['Technicien',         techName],
      ['Période',            PERIOD_LABELS[period]],
      ['Date de génération', fmtDate(new Date().toISOString())],
      ['Interventions',      `${interventions.length}`],
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

  // ── PAGES DE CONTENU ─────────────────────────────────────────────────────────

  doc.addPage();
  y = 18;

  const activeSections = Object.values(sections).filter(Boolean).length;
  let doneSections = 0;
  const tick = () => {
    doneSections++;
    onProgress(0.15 + 0.8 * (doneSections / Math.max(1, activeSections)));
  };

  // ── 1. Résumé & KPIs ─────────────────────────────────────────────────────────

  if (sections.resume) {
    const terminee     = interventions.filter((i) => i.status === 'terminee').length;
    const taux         = interventions.length ? Math.round((terminee / interventions.length) * 100) : 0;
    const totalMins    = interventions.reduce((s, i) => s + (i.timer_elapsed ?? 0), 0);
    const heures       = (totalMins / 60).toFixed(1);
    const totalMat     = interventions.reduce((s, i) => s + (i.materials_installed?.length ?? 0), 0);
    const totalPhotos  = interventions.reduce((s, i) => s + (i.photos?.length ?? 0), 0);

    sectionHeader('RÉSUMÉ & KPIs');

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head:   [['Indicateur', 'Valeur']],
      body:   [
        ['Total interventions',      `${interventions.length}`],
        ['Interventions terminées',  `${terminee} (${taux} %)`],
        ['Heures travaillées',       `${heures} h`],
        ['Matériels installés',      `${totalMat}`],
        ['Photos',                   `${totalPhotos}`],
      ],
      styles:           { fontSize: 9, cellPadding: 3 },
      headStyles:       { fillColor: C.navy, textColor: C.white, fontSize: 8 },
      alternateRowStyles: { fillColor: C.bgLight },
      theme:            'grid',
    });

    y = lastY() + 10;
    tick();
  }

  // ── 2. Tableau des interventions ─────────────────────────────────────────────

  if (sections.tableau) {
    checkPage(20);
    sectionHeader('TABLEAU DES INTERVENTIONS');

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head:   [['Date', 'Client', 'Type', 'Statut', 'Durée']],
      body:   interventions.map((i) => [
        fmtDate(i.date_start),
        i.client_name ?? i.clients?.nom ?? '—',
        i.type_intervention ?? '—',
        fmtStatus(i.status),
        ivDuration(i),
      ]),
      styles:             { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 7 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles:       {
        0: { cellWidth: 30 },
        1: { cellWidth: 52 },
        2: { cellWidth: 40 },
        3: { cellWidth: 26 },
        4: { cellWidth: 22 },
      },
      theme: 'grid',
    });

    y = lastY() + 10;
    tick();
  }

  // ── 3. Checklists ────────────────────────────────────────────────────────────

  if (sections.checklists) {
    const withChk = interventions.filter((i) => i.checklist && i.checklist.length > 0);

    if (withChk.length > 0) {
      checkPage(20);
      sectionHeader('CHECKLISTS');

      for (const iv of withChk) {
        checkPage(12);
        // Sous-titre intervention
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.blue);
        const clientLabel = iv.client_name ?? iv.clients?.nom ?? '';
        doc.text(
          `${iv.title}${clientLabel ? ` — ${clientLabel}` : ''} (${fmtDate(iv.date_start)})`,
          ML, y,
        );
        y += 5;

        for (const item of iv.checklist) {
          checkPage(7);
          const done  = item.done;
          const mark  = done ? '✓' : '✗';
          const color = done ? C.green : C.red;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...color);
          doc.text(mark, ML + 3, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.dark);
          const lines = doc.splitTextToSize(item.label, CW - 14);
          doc.text(lines as string[], ML + 10, y);
          y += Math.max(5, (lines as string[]).length * 4.5);
        }
        y += 3;
      }
    }
    y += 4;
    tick();
  }

  // ── 4. Matériel installé ─────────────────────────────────────────────────────

  if (sections.materiel) {
    const matRows: string[][] = [];
    for (const iv of interventions) {
      for (const m of (iv.materials_installed ?? [])) {
        if (!m.designation && !m.marque && !m.modele) continue;
        matRows.push([
          m.designation ?? '—',
          m.marque      ?? '—',
          m.modele      ?? '—',
          m.serial      ?? '—',
          iv.client_name ?? iv.clients?.nom ?? '—',
          fmtDate(iv.date_start),
        ]);
      }
    }

    if (matRows.length > 0) {
      checkPage(20);
      sectionHeader('MATÉRIEL INSTALLÉ');

      autoTable(doc, {
        startY: y,
        margin: { left: ML, right: MR },
        head:   [['Désignation', 'Marque', 'Modèle', 'N° Série', 'Client', 'Date']],
        body:   matRows,
        styles:             { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 7 },
        alternateRowStyles: { fillColor: C.bgLight },
        columnStyles:       {
          0: { cellWidth: 38 },
          1: { cellWidth: 22 },
          2: { cellWidth: 28 },
          3: { cellWidth: 24 },
          4: { cellWidth: 32 },
          5: { cellWidth: 26 },
        },
        theme: 'grid',
      });

      y = lastY() + 10;
    }
    tick();
  }

  // ── 5. Observations ──────────────────────────────────────────────────────────

  if (sections.obs) {
    const withObs = interventions.filter((i) => i.observations && i.observations.trim().length > 0);

    if (withObs.length > 0) {
      checkPage(20);
      sectionHeader('OBSERVATIONS');

      for (const iv of withObs) {
        checkPage(15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.blue);
        doc.text(`${iv.title} (${fmtDate(iv.date_start)})`, ML, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.dark);
        const lines = doc.splitTextToSize(iv.observations!, CW);
        const blockH = (lines as string[]).length * 4.5 + 6;
        checkPage(blockH);
        doc.setFillColor(...C.bgLight);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, blockH, 2, 2, 'FD');
        doc.text(lines as string[], ML + 4, y + 5);
        y += blockH + 5;
      }
    }
    tick();
  }

  // ── 6. Signatures clients ────────────────────────────────────────────────────

  if (sections.sig) {
    const withSig = interventions.filter((i) => i.signature_data);

    if (withSig.length > 0) {
      checkPage(20);
      sectionHeader('SIGNATURES CLIENTS');

      for (const iv of withSig) {
        checkPage(45);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...C.blue);
        const clientLabel = iv.client_name ?? iv.clients?.nom ?? '';
        doc.text(
          `${iv.title}${clientLabel ? ` — ${clientLabel}` : ''} (${fmtDate(iv.date_start)})`,
          ML, y,
        );
        y += 5;

        try {
          doc.addImage(iv.signature_data!, 'PNG', ML, y, 70, 22);
          y += 25;
        } catch {
          // signature non chargeable
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...C.gray);
        const sigLine = `Signé par ${iv.signature_name ?? 'Client'}${
          iv.signature_date ? ` le ${fmtDate(iv.signature_date)}` : ''
        }`;
        doc.text(sigLine, ML, y);
        y += 8;

        // Ligne séparatrice légère
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(ML, y, 210 - MR, y);
        y += 5;
      }
    }
    tick();
  }

  // ── 7. Temps passé ───────────────────────────────────────────────────────────

  if (sections.temps) {
    checkPage(20);
    sectionHeader('TEMPS PASSÉ');

    const tempsRows = interventions.map((i) => {
      const mins = i.timer_elapsed ?? (
        i.hour_start && i.hour_end
          ? Math.floor((new Date(i.hour_end).getTime() - new Date(i.hour_start).getTime()) / 60000)
          : null
      );
      return [
        i.title,
        fmtDate(i.date_start),
        fmtTime(i.hour_start),
        fmtTime(i.hour_end),
        mins !== null ? fmtDuration(mins) : '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head:   [['Intervention', 'Date', 'Début', 'Fin', 'Durée']],
      body:   tempsRows,
      styles:             { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:         { fillColor: C.navy, textColor: C.white, fontSize: 7 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles:       {
        0: { cellWidth: 60 },
        1: { cellWidth: 32 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 34 },
      },
      theme: 'grid',
    });

    y = lastY() + 10;
    tick();
  }

  // ── PIED DE PAGE (toutes les pages) ──────────────────────────────────────────

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
    doc.text(`OxiFlow — Dossier Technique · Généré le ${genDateStr}`, ML, footY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.navy);
    doc.text(`Page ${pg} / ${pageCount}`, 210 - MR, footY, { align: 'right' });
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName = techName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  doc.save(`OxiFlow_DossierTech_${safeName}_${dateStr}.pdf`);
  onProgress(1.0);
}
