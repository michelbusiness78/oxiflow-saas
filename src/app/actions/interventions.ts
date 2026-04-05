'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/technicien';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChecklistItem = { id: string; label: string; done: boolean };
export type MaterielItem  = { id: string; designation: string; quantite: number; reference: string | null };

export type InterventionInput = {
  client_id:     string;
  projet_id:     string | null;
  technicien_id: string | null;
  date:          string;
  type:          'installation' | 'maintenance' | 'sav' | 'depannage';
  statut:        'planifiee' | 'en_cours' | 'terminee' | 'annulee';
  duree_minutes: number | null;
  notes:         string | null;
  adresse:       string | null;
  photos:        string[];
  checklist:     ChecklistItem[];
  materiel:      MaterielItem[];
  signature_url: string | null;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createInterventionAction(input: InterventionInput) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { error } = await admin.from('interventions').insert({
    tenant_id,
    ...input,
    technicien_id: input.technicien_id ?? user.id,
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateInterventionAction(id: string, input: InterventionInput) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('interventions').update(input).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteInterventionAction(id: string) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('interventions').delete().eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

export async function terminerInterventionAction(
  id: string,
  duree_minutes: number,
  checklist: ChecklistItem[],
  materiel: MaterielItem[],
  notes: string | null,
  photos: string[],
  signature_url: string | null,
) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('interventions').update({
    statut:        'terminee',
    duree_minutes,
    checklist,
    materiel,
    notes,
    photos,
    signature_url,
  }).eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return { success: true };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function uploadInterventionFileAction(
  formData: FormData,
  folder: 'photos' | 'signatures',
): Promise<{ url?: string; path?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();
  const file   = formData.get('file') as File | null;
  if (!file) return { error: 'Aucun fichier fourni.' };

  const ext  = file.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${tenant_id}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from('interventions')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return { error: translateSupabaseError(error.message) };

  const { data: { publicUrl } } = admin.storage
    .from('interventions')
    .getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function deleteInterventionFileAction(path: string) {
  const { admin } = await getAuthContext();
  await admin.storage.from('interventions').remove([path]);
  return { success: true };
}
