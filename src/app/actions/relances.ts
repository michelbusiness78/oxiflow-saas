'use server';

import { revalidatePath }    from 'next/cache';
import { getAuthContext }    from '@/lib/auth-context';
import { createAdminClient } from '@/lib/supabase/server';
import type { RelanceEntry } from '@/app/actions/invoices';
import type { RelanceNiveau } from '@/lib/relance-templates';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelanceItem {
  invoice_id:    string;
  number:        string;
  client_id:     string;
  client_nom:    string;
  client_email:  string | null;
  montant_ttc:   number;
  date_facture:  string;
  date_echeance: string;
  joursRetard:   number;
  niveauPending: RelanceNiveau;
  relance_n1:    RelanceEntry | null;
  relance_n2:    RelanceEntry | null;
  relance_n3:    RelanceEntry | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeNiveauPending(
  joursRetard: number,
  n1: RelanceEntry | null,
  n2: RelanceEntry | null,
  n3: RelanceEntry | null,
): RelanceNiveau | null {
  if (joursRetard >= 30 && !n3) return 3;
  if (joursRetard >= 15 && !n2) return 2;
  if (joursRetard >= 5  && !n1) return 1;
  return null;
}

// ─── detectRelancesAction ─────────────────────────────────────────────────────

export async function detectRelancesAction(tenantId: string): Promise<RelanceItem[]> {
  const admin = await createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: invData } = await admin
    .from('invoices')
    .select('id, number, client_id, total_ttc, date_facture, date_echeance, status, relance_n1, relance_n2, relance_n3, clients(nom, email)')
    .eq('tenant_id', tenantId)
    .in('status', ['emise', 'en_retard'])
    .not('date_echeance', 'is', null)
    .lt('date_echeance', today)
    .order('date_echeance', { ascending: true });

  const items: RelanceItem[] = [];
  const now = Date.now();

  for (const inv of invData ?? []) {
    const joursRetard = Math.max(0, Math.floor((now - new Date(inv.date_echeance as string).getTime()) / 86_400_000));
    const n1 = (inv.relance_n1 as RelanceEntry | null) ?? null;
    const n2 = (inv.relance_n2 as RelanceEntry | null) ?? null;
    const n3 = (inv.relance_n3 as RelanceEntry | null) ?? null;
    const niveauPending = computeNiveauPending(joursRetard, n1, n2, n3);
    if (niveauPending === null) continue;

    const client = inv.clients as unknown as { nom: string; email: string | null } | null;
    items.push({
      invoice_id:    inv.id           as string,
      number:        inv.number       as string,
      client_id:     inv.client_id    as string,
      client_nom:    client?.nom      ?? '—',
      client_email:  client?.email    ?? null,
      montant_ttc:   inv.total_ttc    as number,
      date_facture:  inv.date_facture  as string,
      date_echeance: inv.date_echeance as string,
      joursRetard,
      niveauPending,
      relance_n1: n1,
      relance_n2: n2,
      relance_n3: n3,
    });
  }

  return items;
}

// ─── marquerRelanceAction ─────────────────────────────────────────────────────

export async function marquerRelanceAction(
  invoiceId: string,
  niveau:    RelanceNiveau,
  email:     string,
  sentBy:    string,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const entry: RelanceEntry = {
    date:    new Date().toISOString().split('T')[0],
    email,
    sent_by: sentBy,
  };

  const col = `relance_n${niveau}` as 'relance_n1' | 'relance_n2' | 'relance_n3';
  const patch: Record<string, unknown> = { [col]: entry };

  // Si niveau >= 2 et la facture est encore "emise", passer en "en_retard"
  if (niveau >= 2) {
    const { data: inv } = await admin
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .single();
    if (inv && (inv.status as string) === 'emise') {
      patch.status = 'en_retard';
    }
  }

  const { error } = await admin.from('invoices').update(patch).eq('id', invoiceId);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── getRelancesForClient ─────────────────────────────────────────────────────

export async function getRelancesForClient(
  clientId: string,
  tenantId: string,
): Promise<{
  invoice_id:    string;
  number:        string;
  montant_ttc:   number;
  date_echeance: string;
  relance_n1:    RelanceEntry | null;
  relance_n2:    RelanceEntry | null;
  relance_n3:    RelanceEntry | null;
}[]> {
  const admin = await createAdminClient();

  const { data } = await admin
    .from('invoices')
    .select('id, number, total_ttc, date_echeance, relance_n1, relance_n2, relance_n3')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .or('relance_n1.not.is.null,relance_n2.not.is.null,relance_n3.not.is.null')
    .order('date_echeance', { ascending: false });

  return (data ?? []).map((inv) => ({
    invoice_id:    inv.id            as string,
    number:        inv.number        as string,
    montant_ttc:   inv.total_ttc     as number,
    date_echeance: inv.date_echeance as string,
    relance_n1:    (inv.relance_n1   as RelanceEntry | null) ?? null,
    relance_n2:    (inv.relance_n2   as RelanceEntry | null) ?? null,
    relance_n3:    (inv.relance_n3   as RelanceEntry | null) ?? null,
  }));
}
