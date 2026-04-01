'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth-context';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id:    string;
  label: string;
  done:  boolean;
}

export interface MaterialItem {
  id:       string;
  type:     string;
  marque:   string;
  modele:   string;
  serial:   string;
  location: string;
}

export interface PlanningIntervention {
  id:                  string;
  title:               string;
  date_start:          string;
  date_end:            string | null;
  status:              string;
  type:                string | null;
  nature:              string | null;
  notes:               string | null;
  hours_planned:       number | null;
  is_new:              boolean;
  client_id:           string | null;
  tech_user_id:        string | null;
  project_id:          string | null;
  // Dénormalisés (remplis à la création)
  client_name:         string | null;
  client_address:      string | null;
  client_city:         string | null;
  client_phone:        string | null;
  affair_number:       string | null;
  type_intervention:   string | null;
  // Pointage
  hour_start:          string | null;
  hour_end:            string | null;
  timer_elapsed:       number | null;
  // Contenu
  observations:        string | null;
  checklist:           ChecklistItem[];
  materials_installed: MaterialItem[];
  // Joints (fallback si dénorm absent)
  clients:  { nom: string; adresse: string | null; cp: string | null; ville: string | null; tel: string | null } | null;
  projects: { name: string; affair_number: string | null } | null;
}

// ── Toutes les interventions du technicien ─────────────────────────────────────

export async function getMyInterventions(
  tenantId: string,
  userId:   string,
): Promise<PlanningIntervention[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('interventions')
    .select(`
      id, title, date_start, date_end, status, type, nature, notes,
      hours_planned, is_new, client_id, tech_user_id, project_id,
      client_name, client_address, client_city, client_phone,
      affair_number, type_intervention,
      hour_start, hour_end, timer_elapsed,
      observations, checklist, materials_installed,
      clients ( nom, adresse, cp, ville, tel ),
      projects ( name, affair_number )
    `)
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', userId)
    .order('date_start', { ascending: false });

  return (data ?? []).map((i) => ({
    ...i,
    is_new:              (i.is_new              as boolean | null) ?? false,
    checklist:           (i.checklist           as ChecklistItem[] | null) ?? [],
    materials_installed: (i.materials_installed as MaterialItem[]  | null) ?? [],
  })) as unknown as PlanningIntervention[];
}

// ── Marquer une intervention comme lue (is_new = false) ───────────────────────

export async function markInterventionRead(
  interventionId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('interventions')
    .update({ is_new: false, updated_at: new Date().toISOString() })
    .eq('id', interventionId);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Changer le statut ─────────────────────────────────────────────────────────

export async function updateInterventionStatus(
  interventionId: string,
  newStatus:       'planifiee' | 'en_cours' | 'terminee',
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin
    .from('interventions')
    .update({
      status:     newStatus,
      statut:     newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Sauvegarder la progression (pointage, checklist, matériel, observations) ─

export async function saveInterventionProgress(
  interventionId: string,
  data: {
    hour_start?:          string | null;
    hour_end?:            string | null;
    timer_elapsed?:       number;
    checklist?:           ChecklistItem[];
    materials_installed?: MaterialItem[];
    observations?:        string | null;
  },
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.hour_start          !== undefined) patch.hour_start          = data.hour_start;
  if (data.hour_end            !== undefined) patch.hour_end            = data.hour_end;
  if (data.timer_elapsed       !== undefined) patch.timer_elapsed       = data.timer_elapsed;
  if (data.checklist           !== undefined) patch.checklist           = data.checklist;
  if (data.materials_installed !== undefined) patch.materials_installed = data.materials_installed;
  if (data.observations        !== undefined) patch.observations        = data.observations;

  const { error } = await admin
    .from('interventions')
    .update(patch)
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}
