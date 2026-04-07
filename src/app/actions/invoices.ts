'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath }    from 'next/cache';
import { getAuthContext }    from '@/lib/auth-context';
import { createAdminClient } from '@/lib/supabase/server';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'brouillon' | 'emise' | 'payee' | 'en_retard';

export interface InvoiceLine {
  sort_order:       number;
  reference:        string;
  type:             string;
  designation:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  vat_rate:         number;
  total_ht:         number;  // computed client-side
}

export interface RelanceEntry {
  date:     string;
  email:    string;
  sent_by:  string;
}

export interface EcheancierEntry {
  date:    string;
  montant: number;
  libelle: string;
  paye:    boolean;
}

export interface Invoice {
  id:            string;
  number:        string;
  type:          string;
  quote_id:      string | null;
  quote_number:  string | null;
  client_id:     string;
  company_id:    string | null;
  date_facture:  string;
  date_echeance: string;
  status:        InvoiceStatus;
  conditions:    string | null;
  notes:         string | null;
  total_ht:      number;
  total_tva:     number;
  total_ttc:     number;
  created_at:    string;
  client_nom?:   string;
  relance_n1:    RelanceEntry | null;
  relance_n2:    RelanceEntry | null;
  relance_n3:    RelanceEntry | null;
  avoir_de:      string | null;
  avoir_de_id:   string | null;
  avoir_ref:     string | null;
  echeancier:    EcheancierEntry[];
}

export type InvoiceInput = {
  client_id:     string;
  quote_id?:     string | null;
  quote_number?: string | null;
  company_id?:   string | null;
  date_facture:  string;
  date_echeance: string;
  status:        InvoiceStatus;
  conditions:    string;
  notes:         string;
  lines:         Omit<InvoiceLine, 'total_ht'>[];
  total_ht:      number;
  total_tva:     number;
  total_ttc:     number;
  echeancier?:   EcheancierEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AdminClient = Awaited<ReturnType<typeof getAuthContext>>['admin'];

function calcLine(l: { quantity: number; unit_price: number; discount_percent: number; vat_rate: number }) {
  const ht  = +(l.quantity * l.unit_price * (1 - l.discount_percent / 100)).toFixed(2);
  return { ht, tva: +(ht * l.vat_rate / 100).toFixed(2) };
}

function calcTotals(lines: Omit<InvoiceLine, 'total_ht'>[]) {
  const rows    = lines.map(calcLine);
  const totalHT = +rows.reduce((s, r) => s + r.ht,  0).toFixed(2);
  const totalTV = +rows.reduce((s, r) => s + r.tva, 0).toFixed(2);
  return { totalHT, totalTVA: totalTV, totalTTC: +(totalHT + totalTV).toFixed(2) };
}

async function nextInvoiceNumber(admin: AdminClient, tenant_id: string): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  // Trouve le numéro de séquence le plus élevé pour ce tenant/année
  const { data } = await admin
    .from('invoices')
    .select('number')
    .eq('tenant_id', tenant_id)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1);

  let seq = 0;
  if (data && data.length > 0) {
    const parts = ((data[0].number as string) ?? '').split('-');
    const last  = parts[parts.length - 1];
    seq = parseInt(last, 10) || 0;
  }

  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

async function nextAvoirNumber(admin: AdminClient, tenant_id: string): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `AV-${year}-`;

  const { data } = await admin
    .from('invoices')
    .select('number')
    .eq('tenant_id', tenant_id)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1);

  let seq = 0;
  if (data && data.length > 0) {
    const parts = ((data[0].number as string) ?? '').split('-');
    const last  = parts[parts.length - 1];
    seq = parseInt(last, 10) || 0;
  }

  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

// ─── createAvoirAction ────────────────────────────────────────────────────────

export async function createAvoirAction(
  invoiceId: string,
  mode: 'total' | 'partiel',
  montantPartiel?: number,
): Promise<{ success?: true; avoir?: { id: string; number: string }; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select('id, number, client_id, company_id, total_ht, total_tva, total_ttc, avoir_ref, type')
    .eq('id', invoiceId)
    .single();

  if (invErr || !inv) return { error: 'Facture introuvable.' };
  if ((inv.type as string) === 'avoir') return { error: 'Impossible de créer un avoir sur un avoir.' };
  if (inv.avoir_ref) return { error: `Un avoir existe déjà (${inv.avoir_ref}).` };

  const number = await nextAvoirNumber(admin, tenant_id);
  const today  = new Date().toISOString().split('T')[0];

  let totalHT: number, totalTVA: number, totalTTC: number;

  if (mode === 'total') {
    totalHT  = -(inv.total_ht  as number);
    totalTVA = -(inv.total_tva as number);
    totalTTC = -(inv.total_ttc as number);
  } else {
    const mt = montantPartiel ?? 0;
    totalTTC = -mt;
    totalHT  = +(-mt / 1.2).toFixed(2);  // estimation TVA 20%
    totalTVA = +(totalTTC - totalHT).toFixed(2);
  }

  const { data: avoir, error: avoirErr } = await admin
    .from('invoices')
    .insert({
      tenant_id,
      number,
      type:          'avoir',
      avoir_de:      inv.number as string,
      avoir_de_id:   inv.id     as string,
      client_id:     inv.client_id,
      company_id:    inv.company_id,
      date_facture:  today,
      date_echeance: today,
      status:        'emise',
      total_ht:      totalHT,
      total_tva:     totalTVA,
      total_ttc:     totalTTC,
    })
    .select('id')
    .single();

  if (avoirErr || !avoir) return { error: avoirErr?.message ?? 'Erreur création avoir.' };

  if (mode === 'total') {
    // Copier les lignes en négatif
    const { data: lines } = await admin
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    if (lines && lines.length > 0) {
      await admin.from('invoice_lines').insert(
        lines.map((l) => ({
          invoice_id:       avoir.id,
          sort_order:       l.sort_order,
          reference:        l.reference,
          type:             l.type,
          designation:      l.designation,
          quantity:         -(l.quantity as number),
          unit_price:       l.unit_price,
          discount_percent: l.discount_percent,
          vat_rate:         l.vat_rate,
        })),
      );
    }
  } else {
    await admin.from('invoice_lines').insert({
      invoice_id:       avoir.id,
      sort_order:       0,
      reference:        '',
      type:             'service',
      designation:      `Avoir partiel sur facture ${inv.number as string}`,
      quantity:         1,
      unit_price:       Math.abs(totalHT),
      discount_percent: 0,
      vat_rate:         20,
    });
  }

  // Mettre à jour la facture d'origine avec la référence de l'avoir
  await admin
    .from('invoices')
    .update({ avoir_ref: number, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);

  revalidatePath(PATH);
  return { success: true, avoir: { id: avoir.id as string, number } };
}

// ─── createInvoiceFromQuote ───────────────────────────────────────────────────

export async function createInvoiceFromQuote(quoteId: string): Promise<{
  success?: true;
  invoice?: { id: string; number: string; status: InvoiceStatus };
  existed?: boolean;
  error?: string;
}> {
  const { admin, tenant_id } = await getAuthContext();

  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('id, number, statut, client_id, conditions, lignes')
    .eq('id', quoteId)
    .single();

  if (qErr || !quote) return { error: 'Devis introuvable.' };
  if (quote.statut !== 'accepte') return { error: 'Le devis doit être accepté pour créer une facture.' };

  // Check existing
  const { data: existing } = await admin
    .from('invoices')
    .select('id, number, status')
    .eq('quote_id', quoteId)
    .neq('type', 'avoir')
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      invoice: { id: existing.id as string, number: existing.number as string, status: existing.status as InvoiceStatus },
      existed: true,
    };
  }

  // Map quote lignes → invoice lines
  const quoteLignes = (quote.lignes as Array<{
    reference?: string;
    designation: string;
    quantite: number;
    prix_unitaire: number;
    tva: number;
    remise_pct: number;
  }>) ?? [];

  const lineInputs = quoteLignes.map((l) => ({
    quantity:         l.quantite,
    unit_price:       l.prix_unitaire,
    discount_percent: l.remise_pct,
    vat_rate:         l.tva,
  }));
  const { totalHT, totalTVA, totalTTC } = calcTotals(
    quoteLignes.map((l, i) => ({
      sort_order:       i,
      reference:        l.reference ?? '',
      type:             'materiel',
      designation:      l.designation,
      quantity:         l.quantite,
      unit_price:       l.prix_unitaire,
      discount_percent: l.remise_pct,
      vat_rate:         l.tva,
    })),
  );
  void lineInputs;

  const today    = new Date().toISOString().split('T')[0];
  const echeance = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];
  const number   = await nextInvoiceNumber(admin, tenant_id);

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .insert({
      tenant_id,
      number,
      type:          'facture',
      quote_id:      quote.id,
      quote_number:  quote.number,
      client_id:     quote.client_id,
      date_facture:  today,
      date_echeance: echeance,
      status:        'brouillon',
      conditions:    (quote.conditions as string | null) ?? null,
      total_ht:      totalHT,
      total_tva:     totalTVA,
      total_ttc:     totalTTC,
    })
    .select('id')
    .single();

  if (invErr || !inv) return { error: invErr?.message ?? 'Erreur lors de la création de la facture.' };

  if (quoteLignes.length > 0) {
    const invoiceLines = quoteLignes.map((l, i) => ({
      invoice_id:       inv.id,
      sort_order:       i,
      reference:        l.reference ?? '',
      type:             'materiel',
      designation:      l.designation,
      quantity:         l.quantite,
      unit_price:       l.prix_unitaire,
      discount_percent: l.remise_pct,
      vat_rate:         l.tva,
    }));
    await admin.from('invoice_lines').insert(invoiceLines);
  }

  // Passer le devis en statut "facturé"
  await admin
    .from('quotes')
    .update({ statut: 'facture', updated_at: new Date().toISOString() })
    .eq('id', quoteId);

  revalidatePath(PATH);
  return { success: true, invoice: { id: inv.id as string, number, status: 'brouillon' } };
}

// ─── saveInvoiceAction ────────────────────────────────────────────────────────

export async function saveInvoiceAction(
  input: InvoiceInput,
  id?: string,
): Promise<{ success?: true; id?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { totalHT, totalTVA, totalTTC } = calcTotals(input.lines);

  const common = {
    client_id:     input.client_id,
    quote_id:      input.quote_id ?? null,
    quote_number:  input.quote_number ?? null,
    company_id:    input.company_id ?? null,
    date_facture:  input.date_facture,
    date_echeance: input.date_echeance,
    status:        input.status,
    conditions:    input.conditions || null,
    notes:         input.notes || null,
    total_ht:      totalHT,
    total_tva:     totalTVA,
    total_ttc:     totalTTC,
    echeancier:    input.echeancier ?? [],
    updated_at:    new Date().toISOString(),
  };

  if (id) {
    const { error } = await admin.from('invoices').update(common).eq('id', id);
    if (error) return { error: translateSupabaseError(error.message) };
    await admin.from('invoice_lines').delete().eq('invoice_id', id);
    if (input.lines.length > 0) {
      const { error: lErr } = await admin.from('invoice_lines').insert(
        input.lines.map((l, i) => ({ invoice_id: id, ...l, sort_order: i })),
      );
      if (lErr) return { error: lErr.message };
    }
    revalidatePath(PATH);
    return { success: true, id };
  }

  const number = await nextInvoiceNumber(admin, tenant_id);
  const { data, error } = await admin
    .from('invoices')
    .insert({ tenant_id, number, type: 'facture', ...common })
    .select('id')
    .single();

  if (error) return { error: translateSupabaseError(error.message) };

  if (input.lines.length > 0) {
    await admin.from('invoice_lines').insert(
      input.lines.map((l, i) => ({ invoice_id: data.id, ...l, sort_order: i })),
    );
  }

  revalidatePath(PATH);
  return { success: true, id: data.id };
}

// ─── deleteInvoiceAction ──────────────────────────────────────────────────────

export async function deleteInvoiceAction(invoiceId: string): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const { data: inv } = await admin
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (!inv) return { error: 'Facture introuvable.' };
  if ((inv.status as string) !== 'brouillon') {
    return { error: 'Seules les factures en brouillon peuvent être supprimées.' };
  }

  const { error } = await admin.from('invoices').delete().eq('id', invoiceId);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── changeInvoiceStatusAction ────────────────────────────────────────────────

export async function changeInvoiceStatusAction(
  invoiceId: string,
  newStatus: InvoiceStatus,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const { data: inv } = await admin
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  if (!inv) return { error: 'Facture introuvable.' };

  const current = inv.status as InvoiceStatus;
  const allowed: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
    brouillon: ['emise'],
    emise:     ['payee', 'en_retard', 'brouillon'],
  };

  if (!allowed[current]?.includes(newStatus)) {
    return { error: `Transition ${current} → ${newStatus} non autorisée.` };
  }

  const { error } = await admin
    .from('invoices')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── getInvoices ─────────────────────────────────────────────────────────────

export async function getInvoices(tenantId: string): Promise<Invoice[]> {
  const admin = await createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await admin
    .from('invoices')
    .select(`
      id, number, type, quote_id, quote_number, client_id, company_id,
      date_facture, date_echeance, status, conditions, notes,
      total_ht, total_tva, total_ttc, created_at,
      relance_n1, relance_n2, relance_n3,
      avoir_de, avoir_de_id, avoir_ref, echeancier,
      clients(nom)
    `)
    .eq('tenant_id', tenantId)
    .order('date_facture', { ascending: false });

  return (data ?? []).map((inv) => {
    let status = inv.status as InvoiceStatus;
    if (status === 'emise' && inv.date_echeance && (inv.date_echeance as string) < today) {
      status = 'en_retard';
    }
    return {
      id:            inv.id            as string,
      number:        inv.number        as string,
      type:          inv.type          as string,
      quote_id:      inv.quote_id      as string | null,
      quote_number:  inv.quote_number  as string | null,
      client_id:     inv.client_id     as string,
      company_id:    inv.company_id    as string | null,
      date_facture:  inv.date_facture  as string,
      date_echeance: inv.date_echeance as string,
      status,
      conditions:    inv.conditions    as string | null,
      notes:         inv.notes         as string | null,
      total_ht:      inv.total_ht      as number,
      total_tva:     inv.total_tva     as number,
      total_ttc:     inv.total_ttc     as number,
      created_at:    inv.created_at    as string,
      client_nom:    (inv.clients as unknown as { nom: string } | null)?.nom ?? '—',
      relance_n1:    (inv.relance_n1 as RelanceEntry | null) ?? null,
      relance_n2:    (inv.relance_n2 as RelanceEntry | null) ?? null,
      relance_n3:    (inv.relance_n3 as RelanceEntry | null) ?? null,
      avoir_de:      (inv.avoir_de     as string | null) ?? null,
      avoir_de_id:   (inv.avoir_de_id  as string | null) ?? null,
      avoir_ref:     (inv.avoir_ref    as string | null) ?? null,
      echeancier:    (inv.echeancier   as EcheancierEntry[] | null) ?? [],
    };
  });
}

// ─── getInvoiceLines ──────────────────────────────────────────────────────────

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from('invoice_lines')
    .select('sort_order, reference, type, designation, quantity, unit_price, discount_percent, vat_rate')
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  return (data ?? []).map((l) => ({
    sort_order:       l.sort_order       as number,
    reference:        (l.reference       as string) ?? '',
    type:             (l.type            as string) ?? 'materiel',
    designation:      l.designation      as string,
    quantity:         l.quantity         as number,
    unit_price:       l.unit_price       as number,
    discount_percent: l.discount_percent as number,
    vat_rate:         l.vat_rate         as number,
    total_ht: +(
      (l.quantity as number) * (l.unit_price as number) * (1 - (l.discount_percent as number) / 100)
    ).toFixed(2),
  }));
}
