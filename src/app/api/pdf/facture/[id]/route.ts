// Route API — génération PDF facture (table invoices + invoice_lines)
// Retourne un blob application/pdf directement téléchargeable / affichable.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }       from '@/lib/supabase/server';
import { createAdminClient }  from '@/lib/supabase/server';

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
  const { jsPDF }            = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 14;
  const MR = 14;
  const CW = 210 - ML - MR;
  let y    = 14;

  const C = {
    blue:      [37, 99, 235]   as [number, number, number],
    dark:      [15, 23, 42]    as [number, number, number],
    gray:      [100, 116, 139] as [number, number, number],
    light:     [148, 163, 184] as [number, number, number],
    bgLight:   [248, 250, 252] as [number, number, number],
    border:    [226, 232, 240] as [number, number, number],
    blueLight: [239, 246, 255] as [number, number, number],
    green:     [22, 163, 74]   as [number, number, number],
  };

  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const checkPage = (needed = 20) => {
    if (y + needed > 270) { doc.addPage(); y = 14; }
  };

  const fmtEur = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

  // ── Logo ou nom société ────────────────────────────────────────────────────
  const logoUrl = company?.logo_url as string | null ?? null;
  const coName  = (company?.name as string) ?? '';

  if (logoUrl) {
    try {
      const res  = await fetch(logoUrl);
      const buf  = await res.arrayBuffer();
      const b64  = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/png';
      doc.addImage(`data:${mime};base64,${b64}`, 'PNG', ML, y, 0, 12);
    } catch {
      if (coName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...C.dark);
        doc.text(coName, ML, y + 8);
      }
    }
  } else if (coName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.dark);
    doc.text(coName, ML, y + 8);
  }

  y += 14;

  // ── Titre ─────────────────────────────────────────────────────────────────
  const isAvoir  = (invoice.type as string) === 'avoir';
  const titleStr = isAvoir ? 'AVOIR' : 'FACTURE';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...(isAvoir ? C.green : C.blue));
  doc.text(titleStr, ML, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(`N° ${invoice.number as string}`, ML + 30, y - 1);

  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(fmtDate(invoice.date_facture as string), 210 - MR, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(...(isAvoir ? C.green : C.blue));
  doc.setLineWidth(0.8);
  doc.line(ML, y, 210 - MR, y);
  y += 6;

  // ── 2 colonnes : société + client ─────────────────────────────────────────
  const leftX  = ML;
  const rightX = 110;

  if (company) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.blue);
    doc.text('ÉMETTEUR', leftX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    const coLines: string[] = [coName];
    const addr = [company.address, company.postal_code, company.city].filter(Boolean).join(' ');
    if (addr) coLines.push(addr as string);
    if (company.phone) coLines.push(company.phone as string);
    if (company.email) coLines.push(company.email as string);
    if (company.siret) coLines.push(`SIRET : ${company.siret}`);
    if (company.tva_number) coLines.push(`TVA : ${company.tva_number}`);
    coLines.forEach((line, i) => { doc.text(line, leftX, y + 5 + i * 4.5); });
  }

  const client = invoice.clients as Record<string, unknown> | null;
  if (client) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.blue);
    doc.text('CLIENT', rightX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    const clLines: string[] = [client.nom as string];
    const clAddr = [client.adresse, client.cp, client.ville].filter(Boolean).join(' ');
    if (clAddr) clLines.push(clAddr as string);
    if (client.tel)   clLines.push(client.tel as string);
    if (client.email) clLines.push(client.email as string);
    clLines.forEach((line, i) => { doc.text(line, rightX, y + 5 + i * 4.5); });
  }

  y += 38;

  // Dates
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [],
    body: [
      ['Date facture',  fmtDate(invoice.date_facture  as string)],
      ["Date d'échéance", fmtDate(invoice.date_echeance as string)],
      ...(invoice.quote_number ? [['Devis lié', invoice.quote_number as string]] : []),
    ],
    styles:       { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', textColor: C.gray },
      1: { cellWidth: CW - 40, textColor: C.dark },
    },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.1,
  });
  y = lastY() + 5;

  // ── Lignes ────────────────────────────────────────────────────────────────
  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('DÉTAIL DES PRESTATIONS', ML, y);
  y += 2;

  if (lines.length === 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: [['', 'Aucune ligne']],
      styles: { fontSize: 9, fontStyle: 'italic', textColor: C.light },
      theme: 'plain',
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [['Désignation', 'Réf.', 'Type', 'Qté', 'P.U. HT', 'Remise', 'TVA', 'Total HT']],
      body: lines.map((l) => {
        const ht = +(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toFixed(2);
        return [
          l.designation || '—',
          l.reference   || '—',
          l.type        || '—',
          String(l.quantity),
          fmtEur(l.unit_price),
          l.discount_percent ? `${l.discount_percent}%` : '—',
          `${l.vat_rate}%`,
          fmtEur(ht),
        ];
      }),
      styles:             { fontSize: 8, cellPadding: 2.5 },
      headStyles:         { fillColor: C.blueLight, textColor: C.blue, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 12, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 15, halign: 'right' },
        6: { cellWidth: 12, halign: 'right' },
        7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'striped',
    });
  }

  y = lastY() + 5;

  // ── Totaux ────────────────────────────────────────────────────────────────
  checkPage(30);
  autoTable(doc, {
    startY: y,
    margin: { left: 110, right: MR },
    head: [],
    body: [
      ['Total HT',  fmtEur(invoice.total_ht  as number)],
      ['TVA',       fmtEur(invoice.total_tva as number)],
      ['Total TTC', fmtEur(invoice.total_ttc as number)],
    ],
    styles:       { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.gray },
      1: { halign: 'right', textColor: C.dark },
    },
    theme:          'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.1,
  });
  y = lastY() + 6;

  // ── IBAN / Coordonnées bancaires ──────────────────────────────────────────
  if (company?.iban) {
    checkPage(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.blue);
    doc.text('RÈGLEMENT', ML, y);
    y += 2;

    const bankRows: string[][] = [['IBAN', company.iban as string]];
    if (company.bic) bankRows.push(['BIC', company.bic as string]);
    if (company.mention_tva) bankRows.push(['Mention TVA', company.mention_tva as string]);

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: bankRows,
      styles:       { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', textColor: C.gray },
        1: { cellWidth: CW - 40, textColor: C.dark },
      },
      theme:          'plain',
      tableLineColor: C.border,
      tableLineWidth: 0.1,
    });
    y = lastY() + 5;
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  const noteRaw = [invoice.notes, invoice.conditions].filter(Boolean).join('\n\n');
  if (noteRaw) {
    checkPage(20);
    const noteLines = doc.splitTextToSize(noteRaw as string, CW - 6);
    const noteH     = noteLines.length * 4.5 + 6;
    checkPage(noteH + 5);
    doc.setFillColor(...C.bgLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, noteH, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    doc.text(noteLines, ML + 3, y + 5);
    y += noteH + 5;
  }

  // Mentions légales obligatoires
  checkPage(12);
  const mentions = "En cas de retard de paiement, une pénalité de 3× le taux d'intérêt légal sera appliquée. Indemnité forfaitaire pour frais de recouvrement : 40 €.";
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.light);
  const mentionsLines = doc.splitTextToSize(mentions, CW);
  checkPage(mentionsLines.length * 3.5 + 5);
  doc.text(mentionsLines, ML, y);
  y += mentionsLines.length * 3.5 + 4;

  // ── Pied de page ──────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  const genDate = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const footY = 285;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(ML, footY - 4, 210 - MR, footY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.light);
    doc.text(`Document généré le ${genDate} — OxiFlow`, ML, footY);
    doc.text(`Page ${i}/${pages}`, 210 - MR, footY, { align: 'right' });
    if (company?.pied_facture) {
      doc.text(company.pied_facture as string, ML, footY + 3.5);
    }
  }

  return doc.output('arraybuffer');
}
