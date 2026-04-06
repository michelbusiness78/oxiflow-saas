'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/technicien';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChecklistItem = { id: string; label: string; done: boolean };
export type MaterielItem  = { id: string; designation: string; quantite: number; reference: string | null };

export type InterventionInput = {
  client_id:           string;
  project_id:          string | null;
  tech_user_id:        string | null;
  date_start:          string;
  type_intervention:   'installation' | 'maintenance' | 'sav' | 'depannage';
  status:              'planifiee' | 'en_cours' | 'terminee' | 'annulee';
  timer_elapsed:       number | null;
  observations:        string | null;
  client_address:      string | null;
  photos:              string[];
  checklist:           ChecklistItem[];
  materials_installed: MaterielItem[];
  signature_data:      string | null;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createInterventionAction(input: InterventionInput) {
  const { admin, tenant_id, user } = await getAuthContext();

  const { error } = await admin.from('interventions').insert({
    tenant_id,
    ...input,
    tech_user_id: input.tech_user_id ?? user.id,
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
  timer_elapsed: number,
  checklist: ChecklistItem[],
  materials_installed: MaterielItem[],
  observations: string | null,
  photos: string[],
  signature_data: string | null,
) {
  const { admin } = await getAuthContext();

  const { error } = await admin.from('interventions').update({
    status:              'terminee',
    timer_elapsed,
    checklist,
    materials_installed,
    observations,
    photos,
    signature_data,
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
