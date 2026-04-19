// Route API — génération PDF facture (table invoices + invoice_lines)
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
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select(`
      id, number, type, quote_id, quote_number,
      client_id, company_id,
      date_facture, date_echeance, status,
      conditions, notes,
      total_ht, total_tva, total_ttc,
      clients(nom, adresse, cp, ville, email, tel)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
  }

  // Lignes
  const { data: lines } = await admin
    .from('invoice_lines')
    .select('sort_order, reference, type, designation, quantity, unit_price, discount_percent, vat_rate')
    .eq('invoice_id', id)
    .order('sort_order');

  // Société émettrice
  let company: Record<string, unknown> | null = null;
  if (invoice.company_id) {
    const { data } = await admin
      .from('companies')
      .select('name, address, postal_code, city, phone, email, siret, tva_number, logo_url, iban, bic, mention_tva, pied_facture')
      .eq('id', invoice.company_id as string)
      .single();
    company = data as Record<string, unknown> | null;
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  const pdfBuf = await buildFacturePdf(invoice, lines ?? [], company);

  const filename = `facture-${invoice.number as string}.pdf`;
  return new NextResponse(pdfBuf, {
    status:  200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}

// ─── buildFacturePdf ─────────────────────────────────────────────────────────

type InvLine = {
  sort_order:       number;
  reference:        string;
  type:             string;
  designation:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  vat_rate:         number;
};

async function buildFacturePdf(
  invoice: Record<string, unknown>,
  lines:   InvLine[],
  company: Record<string, unknown> | null,
): Promise<ArrayBuffer> {
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 20;
  const MR = 20;
  const CW = 210 - ML - MR; // 170mm
  let y    = 15;

  // ── Couleurs ──────────────────────────────────────────────────────────────
  const isAvoir = (invoice.type as string) === 'avoir';

  const C = {
    navyHead:  [30,  58,  138] as [number, number, number],
    green:     [21,  128, 61]  as [number, number, number],
    blue:      [37,  99,  235] as [number, number, number],
    dark:      [30,  30,  45]  as [number, number, number],
    gray:      [100, 116, 139] as [number, number, number],
    light:     [150, 165, 185] as [number, number, number],
    bgLight:   [248, 250, 252] as [number, number, number],
    border:    [220, 228, 240] as [number, number, number],
    white:     [255, 255, 255] as [number, number, number],
  };

  const headColor = isAvoir ? C.green : C.navyHead;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const checkPage = (needed = 20) => {
    if (y + needed > 272) { doc.addPage(); y = 15; }
  };

  // Fix : U+202F (espace fine insécable) → espace normal pour jsPDF
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
      // Logo non chargeable → fallback nom texte
    }
  }

  if (logoH === 0 && coName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text(coName, ML, y + 9);
    logoH = 12;
  }

  // Titre "FACTURE" / "AVOIR" aligné à droite
  const titleStr = isAvoir ? 'AVOIR' : 'FACTURE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...headColor);
  doc.text(titleStr, 210 - MR, y + logoH * 0.7, { align: 'right' });

  y += logoH + 10;

  // Ligne de séparation
  doc.setDrawColor(...headColor);
  doc.setLineWidth(0.8);
  doc.line(ML, y, 210 - MR, y);
  y += 7;

  // ── 2 colonnes : émetteur (gauche) + référence/client (droite) ────────────

  const COL_R = ML + CW / 2 + 5;
  const yTop  = y;

  // Colonne gauche — émetteur
  if (company) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('ÉMETTEUR', ML, y);
    y += 4;

    const coLines: string[] = [];
    if (logoH > 0 && logoUrl) coLines.push(coName);
    const addr = [company.address, company.postal_code, company.city]
      .filter(Boolean).join(' ');
    if (addr)               coLines.push(addr as string);
    if (company.phone)      coLines.push(company.phone as string);
    if (company.email)      coLines.push(company.email as string);
    if (company.siret)      coLines.push(`SIRET : ${company.siret}`);
    if (company.tva_number) coLines.push(`TVA : ${company.tva_number}`);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    coLines.forEach((line, i) => { doc.text(line, ML, y + i * 4.8); });
    y += coLines.length * 4.8 + 2;
  }

  // Colonne droite — références
  let yR = yTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text('RÉFÉRENCE', COL_R, yR);
  yR += 4;

  const refRows: string[][] = [
    ['N°',          invoice.number as string],
    ['Date',        fmtDate(invoice.date_facture  as string)],
    ["Échéance",    fmtDate(invoice.date_echeance as string)],
  ];
  if (invoice.quote_number) refRows.push(['Devis lié', invoice.quote_number as string]);

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
  const client = invoice.clients as Record<string, unknown> | null;
  if (client) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('CLIENT', COL_R, yR);
    yR += 4;

    const clLines: string[] = [client.nom as string];
    if (client.adresse) clLines.push(client.adresse as string);
    const cpVille = [client.cp, client.ville].filter(Boolean).join(' ');
    if (cpVille)        clLines.push(cpVille);
    if (client.tel)     clLines.push(client.tel   as string);
    if (client.email)   clLines.push(client.email as string);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    clLines.forEach((line, i) => { doc.text(line, COL_R, yR + i * 4.8); });
    yR += clLines.length * 4.8;
  }

  y = Math.max(y, yR) + 8;

  // ── Lignes ────────────────────────────────────────────────────────────────
  checkPage(30);
  sectionTitle('DÉTAIL DES PRESTATIONS');

  if (lines.length === 0) {
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
      head: [['Désignation', 'Réf.', 'Qté', 'P.U. HT', 'Remise', 'TVA', 'Total HT']],
      body: lines.map((l) => {
        const ht = +(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toFixed(2);
        return [
          l.designation || '—',
          l.reference   || '—',
          String(l.quantity),
          fmtEur(l.unit_price),
          l.discount_percent ? `${l.discount_percent}%` : '—',
          `${l.vat_rate}%`,
          fmtEur(ht),
        ];
      }),
      styles:             { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      headStyles:         {
        fillColor: headColor,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize:  9,
      },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 22 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 16, halign: 'right' },
        5: { cellWidth: 14, halign: 'right' },
        6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'striped',
    });
  }

  y = lastY() + 6;

  // ── Totaux ────────────────────────────────────────────────────────────────
  checkPage(32);

  autoTable(doc, {
    startY:  y,
    margin:  { left: 210 - MR - 80, right: MR },
    head: [],
    body: [
      ['Total HT',  fmtEur(invoice.total_ht  as number)],
      ['TVA',       fmtEur(invoice.total_tva as number)],
      ['Total TTC', fmtEur(invoice.total_ttc as number)],
    ],
    styles:  { fontSize: 10, cellPadding: 3, font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: C.gray },
      1: { cellWidth: 38, halign: 'right',   textColor: C.dark },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) { // Total TTC
        data.cell.styles.fillColor  = headColor;
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

  // ── IBAN / Règlement ──────────────────────────────────────────────────────
  if (company?.iban) {
    checkPage(22);
    sectionTitle('RÈGLEMENT');

    const bankRows: string[][] = [['IBAN', company.iban as string]];
    if (company.bic)        bankRows.push(['BIC',        company.bic        as string]);
    if (company.mention_tva) bankRows.push(['Mention TVA', company.mention_tva as string]);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: bankRows,
      styles:       { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold', textColor: C.gray },
        1: { cellWidth: CW - 30, textColor: C.dark },
      },
      theme:          'plain',
      tableLineColor: C.border,
      tableLineWidth: 0.15,
    });
    y = lastY() + 6;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const noteRaw = [invoice.notes, invoice.conditions].filter(Boolean).join('\n\n');
  if (noteRaw) {
    checkPage(20);
    sectionTitle('NOTES & CONDITIONS');
    const noteLines = doc.splitTextToSize(noteRaw as string, CW - 6);
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

  // Mentions légales
  checkPage(10);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.light);
  const mentions = "En cas de retard de paiement, pénalité de 3× le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.";
  const mentionsLines = doc.splitTextToSize(mentions, CW);
  checkPage(mentionsLines.length * 3.5 + 4);
  doc.text(mentionsLines, ML, y);
  y += mentionsLines.length * 3.5 + 4;

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
