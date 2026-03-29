'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/commerce';

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

export type ClientInput = {
  nom:     string;
  contact: string;
  email:   string;
  tel:     string;
  adresse: string;
  cp:      string;
  ville:   string;
  notes:   string;
};

export async function createClientAction(input: ClientInput) {
  const { admin, tenant_id } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .insert({ ...input, tenant_id });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateClientAction(id: string, input: ClientInput) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .update(input)
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteClientAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin
    .from('clients')
    .delete()
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── DEVIS ────────────────────────────────────────────────────────────────────

export type DevisLigne = {
  designation: string;
  quantite:    number;
  prix_ht:     number;
  tva_pct:     number;
  remise_pct:  number;
};

export type DevisInput = {
  client_id:   string;
  date:        string;
  validite:    string;
  lignes:      DevisLigne[];
  montant_ht:  number;
  tva:         number;
  montant_ttc: number;
  statut:      'brouillon' | 'envoye';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextDevisNum(admin: any, tenant_id: string): Promise<string> {
  const { count } = await admin
    .from('devis')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);
  const n = (count ?? 0) + 1;
  return `DEV-${String(n).padStart(3, '0')}`;
}

export async function createDevisAction(input: DevisInput) {
  const { admin, tenant_id, user } = await getAuthContext();
  const num = await nextDevisNum(admin, tenant_id);
  const { error } = await admin.from('devis').insert({
    ...input,
    num,
    tenant_id,
    commercial_id: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateDevisAction(id: string, input: Partial<DevisInput>) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('devis').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteDevisAction(id: string) {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('devis').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function changeDevisStatutAction(
  id: string,
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse',
) {
  const { admin, tenant_id, user } = await getAuthContext();
  const { error } = await admin.from('devis').update({ statut }).eq('id', id);
  if (error) return { error: error.message };

  // Création automatique d'un projet quand le devis est accepté
  if (statut === 'accepte') {
    const { data: devis } = await admin
      .from('devis')
      .select('id, num, client_id, montant_ht, clients(nom)')
      .eq('id', id)
      .single();

    if (devis) {
      const { data: existing } = await admin
        .from('projets')
        .select('id')
        .eq('devis_id', id)
        .maybeSingle();

      if (!existing) {
        const clientNom = (devis.clients as unknown as { nom: string } | null)?.nom ?? '';
        await admin.from('projets').insert({
          tenant_id,
          client_id:      devis.client_id,
          devis_id:       devis.id,
          chef_projet_id: user.id,
          nom:            `Projet ${clientNom} — ${devis.num}`,
          statut:         'en_attente',
          pct_avancement: 0,
          montant_ht:     devis.montant_ht,
        });
      }
    }
  }

  revalidatePath(PATH);
  revalidatePath('/projets');
  return { success: true };
}

export async function dupliquerDevisAction(id: string) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { data: original, error: fetchErr } = await admin
    .from('devis')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !original) return { error: 'Devis introuvable.' };

  const num = await nextDevisNum(admin, tenant_id);
  const today = new Date().toISOString().split('T')[0];

  const { error } = await admin.from('devis').insert({
    tenant_id,
    client_id:     original.client_id,
    commercial_id: user.id,
    num,
    date:          today,
    validite:      original.validite,
    statut:        'brouillon',
    lignes:        original.lignes,
    montant_ht:    original.montant_ht,
    tva:           original.tva,
    montant_ttc:   original.montant_ttc,
  });

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
