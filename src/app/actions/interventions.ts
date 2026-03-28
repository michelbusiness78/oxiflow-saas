'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const PATH = '/technicien';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Non authentifié');

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('Profil introuvable');

  return { supabase, user, tenant_id: profile.tenant_id };
}

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
  const { supabase, tenant_id, user } = await getAuthContext();

  const { error } = await supabase.from('interventions').insert({
    tenant_id,
    ...input,
    technicien_id: input.technicien_id ?? user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateInterventionAction(id: string, input: InterventionInput) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('interventions').update(input).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteInterventionAction(id: string) {
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('interventions').delete().eq('id', id);
  if (error) return { error: error.message };
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
  const { supabase } = await getAuthContext();

  const { error } = await supabase.from('interventions').update({
    statut:        'terminee',
    duree_minutes,
    checklist,
    materiel,
    notes,
    photos,
    signature_url,
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export async function uploadInterventionFileAction(
  formData: FormData,
  folder: 'photos' | 'signatures',
): Promise<{ url?: string; path?: string; error?: string }> {
  const { tenant_id } = await getAuthContext();
  const admin  = await createAdminClient();
  const file   = formData.get('file') as File | null;
  if (!file) return { error: 'Aucun fichier fourni.' };

  const ext  = file.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${tenant_id}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from('interventions')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = admin.storage
    .from('interventions')
    .getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function deleteInterventionFileAction(path: string) {
  const admin = await createAdminClient();
  await admin.storage.from('interventions').remove([path]);
  return { success: true };
}
