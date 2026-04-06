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
