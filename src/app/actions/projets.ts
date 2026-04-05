'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/projets';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjetInput = {
  client_id:      string;
  nom:            string;
  type_projet:    string | null;
  statut:         string;
  date_debut:     string | null;
  date_fin_prevue:string | null;
  pct_avancement: number;
  montant_ht:     number | null;
  devis_id:       string | null;
  facture_id:     string | null;
  chef_projet_id: string | null;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createProjetAction(input: ProjetInput) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { error } = await admin.from('projets').insert({
    tenant_id,
    ...input,
    chef_projet_id: input.chef_projet_id ?? user.id,
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateProjetAction(id: string, input: ProjetInput) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('projets').update(input).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteProjetAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('projets').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateProjetAvancementAction(id: string, pct: number) {
  const { admin } = await getAuthContext();

  const { error } = await admin
    .from('projets')
    .update({ pct_avancement: Math.max(0, Math.min(100, pct)) })
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── Auto-création depuis devis ───────────────────────────────────────────────

export async function createProjetFromDevisAction(devisId: string) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { data: devis, error: fetchErr } = await admin
    .from('devis')
    .select('id, num, client_id, montant_ht, clients(nom)')
    .eq('id', devisId)
    .single();

  if (fetchErr || !devis) return { error: 'Devis introuvable.' };

  const clientNom = (devis.clients as unknown as { nom: string } | null)?.nom ?? '';

  const { data: existing } = await admin
    .from('projets')
    .select('id')
    .eq('devis_id', devisId)
    .maybeSingle();

  if (existing) return { success: true, already: true };

  const { error } = await admin.from('projets').insert({
    tenant_id,
    client_id:       devis.client_id,
    devis_id:        devis.id,
    chef_projet_id:  user.id,
    nom:             `Projet ${clientNom} — ${devis.num}`,
    statut:          'en_attente',
    pct_avancement:  0,
    montant_ht:      devis.montant_ht,
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  revalidatePath('/commerce');
  return { success: true };
}
