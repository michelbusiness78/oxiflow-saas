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
    clients:    { nom: string; ville: string | null } | null;
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

export interface TechnicienKpiData {
  todayCount:      number;
  todayDone:       number;
  weekCount:       number;
  weekRemaining:   number;
  pendingCount:    number;
  nextPendingDate: string | null;
  monthDone:       number;
  monthTotal:      number;
}

// ── Notifications non lues ────────────────────────────────────────────────────

export async function getInterventionNotifications(
  tenantId: string,
  userId:   string,
): Promise<InterventionNotifData[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('intervention_notifications')
    .select(`
      id, intervention_id, title, message, created_at,
      interventions ( title, date_start, date_end, clients ( nom, ville ), projects ( name ) )
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false });

  return (data ?? []) as unknown as InterventionNotifData[];
}

// ── Marquer une notification comme lue ────────────────────────────────────────

export async function markInterventionNotificationRead(
  notificationId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('intervention_notifications')
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) return { error: error.message };

  revalidatePath('/technicien');
  return {};
}

// ── Planning du technicien (toutes ses interventions) ─────────────────────────

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

// ── KPIs technicien ───────────────────────────────────────────────────────────

export async function getTechnicienKpis(
  tenantId: string,
  userId:   string,
): Promise<TechnicienKpiData> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('interventions')
    .select('id, date_start, status')
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', userId)
    .order('date_start', { ascending: true });

  const all = data ?? [];

  // Bornes temporelles (minuit local)
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  // Lundi de la semaine courante
  const weekStart  = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7));
  const weekEnd    = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Aujourd'hui
  const todayItems    = all.filter((i) => { const d = new Date(i.date_start); return d >= todayStart && d <= todayEnd; });
  const todayCount    = todayItems.length;
  const todayDone     = todayItems.filter((i) => i.status === 'terminee').length;

  // Cette semaine
  const weekItems     = all.filter((i) => { const d = new Date(i.date_start); return d >= weekStart && d <= weekEnd; });
  const weekCount     = weekItems.length;
  const weekRemaining = weekItems.filter((i) => i.status !== 'terminee' && i.status !== 'annulee').length;

  // En attente (planifiée + date future ou aujourd'hui)
  const pendingItems  = all.filter((i) => i.status === 'planifiee' && new Date(i.date_start) >= todayStart);
  const pendingCount  = pendingItems.length;
  const nextPendingDate = pendingItems[0]?.date_start ?? null;

  // Ce mois
  const monthItems    = all.filter((i) => { const d = new Date(i.date_start); return d >= monthStart && d <= monthEnd; });
  const monthDone     = monthItems.filter((i) => i.status === 'terminee').length;
  const monthTotal    = monthItems.length;

  return {
    todayCount,
    todayDone,
    weekCount,
    weekRemaining,
    pendingCount,
    nextPendingDate,
    monthDone,
    monthTotal,
  };
}
