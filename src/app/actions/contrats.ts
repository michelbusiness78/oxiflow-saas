'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MaterielCouvert = {
  id:           string;
  designation:  string;
  reference:    string | null;
  numero_serie: string | null;
  quantite:     number;
};

export type ContratStatut    = 'actif' | 'expire' | 'resilie';
export type ContratFrequence = 'mensuel' | 'trimestriel' | 'annuel';

export type ContratInput = {
  client_id:        string;
  type:             'maintenance' | 'support' | 'location';
  nom:              string | null;
  description:      string | null;
  frequence:        ContratFrequence | null;
  montant_mensuel:  number | null;
  date_debut:       string;
  date_fin:         string | null;
  statut:           ContratStatut;
  actif:            boolean;
  materiel_couvert: MaterielCouvert[];
  project_id:       string | null;
  company_id:       string | null;
  notes:            string | null;
};

// ─── Auto-numérotation CTR-YYYY-NNN ───────────────────────────────────────────

async function generateNumero(
  admin: Awaited<ReturnType<typeof getAuthContext>>['admin'],
  tenant_id: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await admin
    .from('contrats')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${year}-01-01T00:00:00`);
  const n = String((count ?? 0) + 1).padStart(3, '0');
  return `CTR-${year}-${n}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createContratAction(input: ContratInput) {
  const { admin, tenant_id } = await getAuthContext();
  const numero = await generateNumero(admin, tenant_id);
  const { error } = await admin.from('contrats').insert({
    ...input,
    numero,
    tenant_id,
    actif: input.statut === 'actif',
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateContratAction(id: string, input: Partial<ContratInput>) {
  const { admin } = await getAuthContext();
  const patch: Record<string, unknown> = { ...input };
  if (input.statut !== undefined) patch.actif = input.statut === 'actif';
  const { error } = await admin.from('contrats').update(patch).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteContratAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('contrats').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function toggleContratActifAction(id: string, actif: boolean) {
  const { admin } = await getAuthContext();
  const statut: ContratStatut = actif ? 'actif' : 'resilie';
  const { error } = await admin.from('contrats').update({ actif, statut }).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── renouvellerContratAction ─────────────────────────────────────────────────

export async function renouvellerContratAction(contratId: string): Promise<{ newDateFin?: string; error?: string }> {
  const { admin } = await getAuthContext();

  const { data: contrat, error: cErr } = await admin
    .from('contrats')
    .select('date_debut, date_fin')
    .eq('id', contratId)
    .single();

  if (cErr || !contrat) return { error: 'Contrat introuvable.' };
  const c = contrat as Record<string, unknown>;
  if (!c.date_fin) return { error: 'Ce contrat n\'a pas de date de fin définie.' };

  const dateFin   = new Date(c.date_fin  as string);
  const dateDebut = new Date(c.date_debut as string);
  const durationMs = dateFin.getTime() - dateDebut.getTime();

  const newDateDebut = new Date(dateFin.getTime() + 86_400_000); // +1 jour
  const newDateFin   = new Date(newDateDebut.getTime() + durationMs);

  const newDateDebutStr = newDateDebut.toISOString().split('T')[0];
  const newDateFinStr   = newDateFin.toISOString().split('T')[0];

  const { error } = await admin
    .from('contrats')
    .update({
      date_debut:  newDateDebutStr,
      date_fin:    newDateFinStr,
      statut:      'actif',
      actif:       true,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', contratId);

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { newDateFin: newDateFinStr };
}

// ─── factureContratAction ──────────────────────────────────────────────────────

export async function factureContratAction(contratId: string): Promise<{ number?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  // Fetch contrat
  const { data: contrat, error: cErr } = await admin
    .from('contrats')
    .select('id, type, nom, numero, montant_mensuel, frequence, client_id, company_id, date_debut, date_fin, statut')
    .eq('id', contratId)
    .single();

  if (cErr || !contrat) return { error: 'Contrat introuvable.' };
  const c = contrat as Record<string, unknown>;
  if ((c.statut as string) !== 'actif') return { error: 'Le contrat doit être actif pour facturer.' };
  if (!c.montant_mensuel) return { error: 'Le contrat n\'a pas de montant défini.' };

  // Fetch client conditions_paiement for echeance
  const { data: clientRow } = await admin
    .from('clients')
    .select('conditions_paiement')
    .eq('id', c.client_id as string)
    .single();

  // montant_mensuel stocke le montant PAR PÉRIODE (pas forcément mensuel).
  // Le formulaire affiche "Montant par trimestre/an/mois" — on facture ce montant tel quel.
  const montantMensuel = c.montant_mensuel as number;
  const frequence = (c.frequence as string) || 'mensuel';
  const totalHT = +montantMensuel.toFixed(2);
  const totalTVA = +(totalHT * 0.20).toFixed(2);
  const totalTTC = +(totalHT + totalTVA).toFixed(2);

  // Calcul date_echeance depuis conditions_paiement
  const conditions = (clientRow?.conditions_paiement as string | null) ?? null;
  let days = 30;
  if (conditions) {
    const m = conditions.match(/(\d+)/);
    if (m) days = parseInt(m[1], 10);
    if (/imm[eé]diat/i.test(conditions)) days = 0;
  }
  const today    = new Date().toISOString().split('T')[0];
  const echeance = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0];

  // Numéro de facture séquentiel FAC-YYYY-NNN
  const year   = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const { data: lastInv } = await admin
    .from('invoices')
    .select('number')
    .eq('tenant_id', tenant_id)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1);
  let seq = 0;
  if (lastInv && lastInv.length > 0) {
    const parts = ((lastInv[0].number as string) ?? '').split('-');
    seq = parseInt(parts[parts.length - 1], 10) || 0;
  }
  const number = `${prefix}${String(seq + 1).padStart(3, '0')}`;

  // Libellé période
  const periodeLabel = frequence === 'trimestriel' ? 'Trimestre en cours'
                     : frequence === 'annuel'       ? 'Année en cours'
                                                    : 'Mois en cours';
  const notes = [
    'Facture contrat',
    c.numero ? (c.numero as string) : null,
    c.nom ? (c.nom as string) : (c.type as string),
    `Période : ${periodeLabel}`,
  ].filter(Boolean).join(' - ');

  // INSERT invoices
  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .insert({
      tenant_id,
      number,
      type:          'contrat',
      client_id:     c.client_id,
      company_id:    (c.company_id as string | null) ?? null,
      date_facture:  today,
      date_echeance: echeance,
      status:        'emise',
      notes,
      total_ht:      totalHT,
      total_tva:     totalTVA,
      total_ttc:     totalTTC,
    })
    .select('id')
    .single();

  if (invErr || !inv) return { error: translateSupabaseError(invErr?.message ?? 'Erreur création facture') };

  // INSERT invoice_lines
  const TYPE_FR: Record<string, string> = { maintenance: 'Maintenance', support: 'Support', location: 'Location' };
  const typeFr = TYPE_FR[(c.type as string)] ?? (c.type as string);
  const designation = `Contrat ${typeFr}${c.nom ? ` - ${c.nom as string}` : ''} - ${periodeLabel}`;

  await admin.from('invoice_lines').insert({
    invoice_id:       (inv as { id: string }).id,
    sort_order:       0,
    reference:        (c.numero as string | null) ?? '',
    type:             'service',
    designation,
    quantity:         1,
    unit_price:       totalHT,
    discount_percent: 0,
    vat_rate:         20,
  });

  revalidatePath(PATH);
  return { number };
}
