'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InterventionNotifData {
  id:              string;
  intervention_id: string;
  title:           string;
  message:         string | null;
  created_at:      string;
  interventions: {
    title:      string;
    date_start: string;
    date_end:   string | null;
    clients:    { nom: string } | null;
    projects:   { name: string } | null;
  } | null;
}

export interface PlanningIntervention {
  id:           string;
  title:        string;
  date_start:   string;
  date_end:     string | null;
  status:       string;
  type:         string | null;
  notes:        string | null;
  client_id:    string | null;
  tech_user_id: string | null;
  project_id:   string | null;
  clients:      { nom: string; ville: string | null } | null;
  projects:     { name: string } | null;
}

// ── Récupérer les notifications non acceptées ─────────────────────────────────

export async function getInterventionNotifications(
  tenantId: string,
  userId:   string,
): Promise<InterventionNotifData[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('intervention_notifications')
    .select(`
      id, intervention_id, title, message, created_at,
      interventions ( title, date_start, date_end, clients ( nom ), projects ( name ) )
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('accepted', false)
    .order('created_at', { ascending: false });

  return (data ?? []) as unknown as InterventionNotifData[];
}

// ── Accepter une notification ─────────────────────────────────────────────────

export async function acceptInterventionNotification(
  notificationId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('intervention_notifications')
    .update({ accepted: true, read: true, updated_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) return { error: error.message };

  revalidatePath('/technicien');
  return {};
}

// ── Récupérer le planning du technicien (interventions chef-projet) ────────────

export async function getMyInterventions(
  tenantId: string,
  userId:   string,
): Promise<PlanningIntervention[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('interventions')
    .select(`
      id, title, date_start, date_end, status, type, notes,
      client_id, tech_user_id, project_id,
      clients ( nom, ville ),
      projects ( name )
    `)
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', userId)
    .order('date_start', { ascending: true });

  return (data ?? []) as unknown as PlanningIntervention[];
}
