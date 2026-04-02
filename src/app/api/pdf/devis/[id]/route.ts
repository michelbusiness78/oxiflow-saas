// Route API — génération PDF devis (table quotes + invoice_lines)
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
      .select('name, address, postal_code, city, phone, email, siret, tva_number, logo_url, iban, bic, mention_tva, conditions_paiement_defaut')
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
  const { jsPDF }            = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 14;
  const MR = 14;
  const CW = 210 - ML - MR;
  let y  = 14;

  const C = {
    blue:      [37, 99, 235]   as [number, number, number],
    dark:      [15, 23, 42]    as [number, number, number],
    gray:      [100, 116, 139] as [number, number, number],
    light:     [148, 163, 184] as [number, number, number],
    bgLight:   [248, 250, 252] as [number, number, number],
    border:    [226, 232, 240] as [number, number, number],
    blueLight: [239, 246, 255] as [number, number, number],
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
  const logoUrl  = company?.logo_url as string | null ?? null;
  const coName   = (company?.name as string) ?? '';

  if (logoUrl) {
    try {
      const res  = await fetch(logoUrl);
      const buf  = await res.arrayBuffer();
      const b64  = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type') ?? 'image/png';
      const dataUrl = `data:${mime};base64,${b64}`;
      doc.addImage(dataUrl, 'PNG', ML, y, 0, 12);
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.blue);
  doc.text('DEVIS', ML, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(`N° ${quote.number as string}`, ML + 22, y - 1);

  // Date droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  const dateStr = quote.date ? fmtDate(quote.date as string) : '';
  doc.text(dateStr, 210 - MR, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(...C.blue);
  doc.setLineWidth(0.8);
  doc.line(ML, y, 210 - MR, y);
  y += 6;

  // ── 2 colonnes : société + client ─────────────────────────────────────────
  const leftX  = ML;
  const rightX = 110;

  // Bloc société
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
    coLines.forEach((line, i) => {
      doc.text(line, leftX, y + 5 + i * 4.5);
    });
  }

  // Bloc client
  const client = quote.clients as Record<string, unknown> | null;
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
    clLines.forEach((line, i) => {
      doc.text(line, rightX, y + 5 + i * 4.5);
    });
  }

  y += (company || client) ? 38 : 5;

  // Objet + affaire
  checkPage(15);
  const metaRows: string[][] = [];
  if (quote.objet)         metaRows.push(['Objet', quote.objet as string]);
  if (quote.affair_number) metaRows.push(['N° Affaire', quote.affair_number as string]);
  if (quote.validity)      metaRows.push(['Validité', fmtDate(quote.validity as string)]);

  if (metaRows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: metaRows,
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

  // ── Lignes ────────────────────────────────────────────────────────────────
  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('DÉTAIL DES PRESTATIONS', ML, y);
  y += 2;

  const lignes = (quote.lignes as QuoteLigne[]) ?? [];

  if (lignes.length === 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: [['', 'Aucune ligne']],
      styles:       { fontSize: 9, fontStyle: 'italic', textColor: C.light },
      columnStyles: { 0: { cellWidth: 40 } },
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
      styles:             { fontSize: 8, cellPadding: 2.5 },
      headStyles:         { fillColor: C.blueLight, textColor: C.blue, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles:       {
        0: { cellWidth: 55 },
        1: { cellWidth: 22 },
        2: { cellWidth: 12, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 17, halign: 'right' },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'striped',
    });
  }

  y = lastY() + 5;

  // ── Totaux ────────────────────────────────────────────────────────────────
  checkPage(30);
  const totRows: [string, string][] = [
    ['Total HT',  fmtEur(quote.montant_ht as number)],
    ['TVA',       fmtEur(quote.tva_amount  as number)],
    ['Total TTC', fmtEur(quote.montant_ttc as number)],
  ];
  if ((quote.deposit_percent as number) > 0) {
    const acompte = ((quote.montant_ttc as number) * (quote.deposit_percent as number)) / 100;
    totRows.push([`Acompte (${quote.deposit_percent}%)`, fmtEur(acompte)]);
  }

  autoTable(doc, {
    startY:  y,
    margin:  { left: 110, right: MR },
    head: [],
    body:    totRows,
    styles:  { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.gray },
      1: { halign: 'right', textColor: C.dark },
    },
    didDrawCell: (data) => {
      if (data.row.index === 2) {
        doc.setFillColor(...C.blueLight);
      }
    },
    theme: 'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.1,
  });

  y = lastY() + 6;

  // ── Notes & Conditions ────────────────────────────────────────────────────
  if (quote.notes || quote.conditions) {
    checkPage(25);
    const noteText = [quote.notes, quote.conditions].filter(Boolean).join('\n\n') as string;
    const noteLines = doc.splitTextToSize(noteText, CW - 6);
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
