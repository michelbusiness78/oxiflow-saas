// Route API — génération PDF devis (table quotes)
// Retourne un blob application/pdf directement téléchargeable / affichable.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  const tenantId = profile.tenant_id as string;
  const { id }   = await params;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select(`
      id, number, affair_number, objet, date, validity, statut,
      lignes, notes, conditions, deposit_percent,
      montant_ht, tva_amount, montant_ttc,
      client_id, company_id,
      clients(nom, adresse, cp, ville, email, tel)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  // Société émettrice
  let company: Record<string, unknown> | null = null;
  if (quote.company_id) {
    const { data } = await admin
      .from('companies')
      .select('name, address, postal_code, city, phone, email, siret, tva_number, logo_url, iban, bic, mention_tva, conditions_paiement_defaut, pied_facture')
      .eq('id', quote.company_id as string)
      .single();
    company = data as Record<string, unknown> | null;
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  const pdfBuf = await buildDevisPdf(quote, company);

  return new NextResponse(pdfBuf, {
    status:  200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="devis-${quote.number as string}.pdf"`,
    },
  });
}

// ─── buildDevisPdf ────────────────────────────────────────────────────────────

type QuoteLigne = {
  designation:   string;
  reference?:    string;
  quantite:      number;
  unite?:        string;
  prix_unitaire: number;
  tva:           number;
  remise_pct:    number;
  total_ht:      number;
};

async function buildDevisPdf(
  quote:   Record<string, unknown>,
  company: Record<string, unknown> | null,
): Promise<ArrayBuffer> {
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 20;            // margin left
  const MR = 20;            // margin right
  const CW = 210 - ML - MR; // content width = 170mm
  let y    = 15;

  // ── Couleurs ──────────────────────────────────────────────────────────────
  const C = {
    navyHead:  [30,  58,  138] as [number, number, number], // #1e3a8a — en-têtes tableaux
    blue:      [37,  99,  235] as [number, number, number], // titres sections
    dark:      [30,  30,  45]  as [number, number, number], // texte principal
    gray:      [100, 116, 139] as [number, number, number], // labels
    light:     [150, 165, 185] as [number, number, number], // pied de page
    bgLight:   [248, 250, 252] as [number, number, number], // fond alternance
    bgTtc:     [239, 246, 255] as [number, number, number], // fond ligne TTC
    border:    [220, 228, 240] as [number, number, number], // bordures
    white:     [255, 255, 255] as [number, number, number],
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const checkPage = (needed = 20) => {
    if (y + needed > 272) { doc.addPage(); y = 15; }
  };

  // Fix : Intl.NumberFormat fr-FR utilise U+202F (espace fine insécable) pour
  // les milliers — jsPDF ne connaît pas ce caractère → backslash. On remplace.
  const fmtEur = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
      .format(n)
      .replace(/\u00a0|\u202f/g, ' ');

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(iso));

  const sectionTitle = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.blue);
    doc.text(text, ML, y);
    y += 3;
  };

  // ── EN-TÊTE : logo + titre ────────────────────────────────────────────────

  const logoUrl = company?.logo_url as string | null ?? null;
  const coName  = (company?.name    as string)       ?? '';

  // Logo (max 15mm hauteur, largeur proportionnelle)
  let logoH = 0;
  if (logoUrl) {
    try {
      const res     = await fetch(logoUrl);
      const buf     = await res.arrayBuffer();
      const b64     = Buffer.from(buf).toString('base64');
      const mime    = res.headers.get('content-type') ?? 'image/png';
      const dataUrl = `data:${mime};base64,${b64}`;
      doc.addImage(dataUrl, 'PNG', ML, y, 0, 15); // hauteur 15mm, largeur auto
      logoH = 15;
    } catch {
      // Logo non chargeable → fallback nom en texte
    }
  }

  if (logoH === 0 && coName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text(coName, ML, y + 9);
    logoH = 12;
  }

  // Titre "DEVIS" aligné à droite sur la même ligne que le logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...C.navyHead);
  doc.text('DEVIS', 210 - MR, y + logoH * 0.7, { align: 'right' });

  y += logoH + 10; // gap de 10mm sous le logo/nom

  // Ligne de séparation
  doc.setDrawColor(...C.navyHead);
  doc.setLineWidth(0.8);
  doc.line(ML, y, 210 - MR, y);
  y += 7;

  // ── 2 colonnes : émetteur (gauche) + référence/client (droite) ────────────

  const COL_R = ML + CW / 2 + 5; // colonne droite commence à ~115mm
  const yTop  = y;

  // Colonne gauche — émetteur
  if (company) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('ÉMETTEUR', ML, y);
    y += 4;

    const coLines: string[] = [];
    if (logoH > 0 && logoUrl) coLines.push(coName); // nom sous logo si logo présent
    const addr = [company.address, company.postal_code, company.city]
      .filter(Boolean).join(' ');
    if (addr)              coLines.push(addr as string);
    if (company.phone)     coLines.push(company.phone as string);
    if (company.email)     coLines.push(company.email as string);
    if (company.siret)     coLines.push(`SIRET : ${company.siret}`);
    if (company.tva_number) coLines.push(`TVA : ${company.tva_number}`);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    coLines.forEach((line, i) => { doc.text(line, ML, y + i * 4.8); });
    y += coLines.length * 4.8 + 2;
  }

  // Colonne droite — infos document
  let yR = yTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text('RÉFÉRENCE', COL_R, yR);
  yR += 4;

  const refRows: string[][] = [
    ['N°',        quote.number    as string],
    ['Date',      quote.date ? fmtDate(quote.date as string) : '—'],
  ];
  if (quote.affair_number) refRows.push(['Affaire', quote.affair_number as string]);
  if (quote.validity)      refRows.push(['Validité', fmtDate(quote.validity as string)]);

  autoTable(doc, {
    startY: yR,
    margin: { left: COL_R, right: MR },
    head: [],
    body: refRows,
    styles:       { fontSize: 9, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', textColor: C.gray },
      1: { cellWidth: 170 - COL_R + ML, textColor: C.dark },
    },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.15,
  });
  yR = lastY() + 4;

  // Client
  const client = quote.clients as Record<string, unknown> | null;
  if (client) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('CLIENT', COL_R, yR);
    yR += 4;

    const clLines: string[] = [client.nom as string];
    const clAddr = [client.adresse, client.cp, client.ville]
      .filter(Boolean).join(' ');
    if (clAddr)      clLines.push(clAddr as string);
    if (client.tel)  clLines.push(client.tel  as string);
    if (client.email) clLines.push(client.email as string);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    clLines.forEach((line, i) => { doc.text(line, COL_R, yR + i * 4.8); });
    yR += clLines.length * 4.8;
  }

  y = Math.max(y, yR) + 8;

  // Objet
  if (quote.objet) {
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text(`Objet : `, ML, y);
    doc.setFont('helvetica', 'normal');
    const objetW = doc.getTextWidth('Objet : ');
    doc.text(quote.objet as string, ML + objetW, y);
    y += 7;
  }

  // ── Lignes ────────────────────────────────────────────────────────────────
  checkPage(30);
  sectionTitle('DÉTAIL DES PRESTATIONS');

  const lignes = (quote.lignes as QuoteLigne[]) ?? [];

  if (lignes.length === 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: [['Aucune ligne renseignée']],
      styles: { fontSize: 9, fontStyle: 'italic', textColor: C.light },
      theme: 'plain',
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [['Désignation', 'Réf.', 'Qté', 'P.U. HT', 'TVA', 'Remise', 'Total HT']],
      body: lignes.map((l) => [
        l.designation || '—',
        l.reference   || '—',
        String(l.quantite),
        fmtEur(l.prix_unitaire),
        `${l.tva}%`,
        l.remise_pct ? `${l.remise_pct}%` : '—',
        fmtEur(l.total_ht),
      ]),
      styles:             { fontSize: 9,  cellPadding: 3, font: 'helvetica' },
      headStyles:         {
        fillColor: C.navyHead,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize:  9,
      },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles: {
        0: { cellWidth: 56 },
        1: { cellWidth: 20 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'striped',
    });
  }

  y = lastY() + 6;

  // ── Totaux ────────────────────────────────────────────────────────────────
  checkPage(32);

  const totRows: [string, string][] = [
    ['Total HT',  fmtEur(quote.montant_ht  as number)],
    ['TVA',       fmtEur(quote.tva_amount  as number)],
    ['Total TTC', fmtEur(quote.montant_ttc as number)],
  ];
  if ((quote.deposit_percent as number) > 0) {
    const acompte = ((quote.montant_ttc as number) * (quote.deposit_percent as number)) / 100;
    totRows.push([`Acompte (${quote.deposit_percent}%)`, fmtEur(acompte)]);
  }

  const ttcRowIdx = 2;

  autoTable(doc, {
    startY:  y,
    margin:  { left: 210 - MR - 80, right: MR },
    head: [],
    body:    totRows,
    styles:  { fontSize: 10, cellPadding: 3, font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: C.gray },
      1: { cellWidth: 38, halign: 'right',   textColor: C.dark },
    },
    didParseCell: (data) => {
      if (data.row.index === ttcRowIdx) {
        data.cell.styles.fillColor  = C.navyHead;
        data.cell.styles.textColor  = C.white;
        data.cell.styles.fontStyle  = 'bold';
        data.cell.styles.fontSize   = 11;
      }
    },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.2,
  });

  y = lastY() + 8;

  // ── Notes & Conditions ────────────────────────────────────────────────────
  const noteRaw = [quote.notes, quote.conditions].filter(Boolean).join('\n\n') as string;
  if (noteRaw) {
    checkPage(20);
    sectionTitle('NOTES & CONDITIONS');
    const noteLines = doc.splitTextToSize(noteRaw, CW - 6);
    const noteH     = noteLines.length * 5 + 8;
    checkPage(noteH + 5);
    doc.setFillColor(...C.bgLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, noteH, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.text(noteLines, ML + 4, y + 6);
    y += noteH + 6;
  }

  // ── Pied de page ──────────────────────────────────────────────────────────
  const pages   = doc.getNumberOfPages();
  const genDate = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const footY = 284;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(ML, footY - 5, 210 - MR, footY - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.light);
    doc.text(`Document généré le ${genDate} — OxiFlow`, ML, footY);
    doc.text(`Page ${i}/${pages}`, 210 - MR, footY, { align: 'right' });
    if (company?.pied_facture) {
      doc.setFontSize(7);
      doc.text(company.pied_facture as string, ML, footY + 4);
    }
  }

  return doc.output('arraybuffer');
}
