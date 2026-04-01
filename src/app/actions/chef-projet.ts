'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/chef-projet';

// ── Types publics ──────────────────────────────────────────────────────────────

export interface CalendarEventData {
  id:           string;
  title:        string;
  startISO:     string;
  endISO:       string;
  type:         'intervention' | 'project';
  status?:      string;
  color:        string;
  client_id?:   string;
  tech_user_id?: string;
  clientNom?:   string;
  techNom?:     string;
  projectId?:   string;
  notes?:       string;
}

export interface DashboardData {
  projetsEnCours:     number;
  interventionsToday: number;
  tachesEnRetard:     number;
  techsActifs:        number;
  equipeAujourdhui:   { userId: string; name: string; count: number }[];
  chantiersEnCours:   {
    id:         string;
    name:       string;
    clientNom:  string;
    deadline:   string | null;
    status:     string;
    amount_ttc: number;
  }[];
}

export interface InterventionInput {
  title:         string;
  date_start:    string;   // ISO
  date_end?:     string;   // ISO
  client_id?:    string;
  project_id?:   string;
  tech_user_id?: string;
  tech_name?:    string;
  status?:       string;
  notes?:        string;
  type?:         string;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const INTERVENTION_COLORS: Record<string, string> = {
  planifiee: '#93c5fd',
  en_cours:  '#fb923c',
  terminee:  '#86efac',
  annulee:   '#cbd5e1',
};

// ── getDashboardChefProjet ─────────────────────────────────────────────────────

export async function getDashboardChefProjet(): Promise<DashboardData> {
  const { admin, tenant_id } = await getAuthContext();

  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayStart = `${todayStr}T00:00:00+00:00`;
  const todayEnd   = `${todayStr}T23:59:59+00:00`;

  const [projRes, intRes, tachRes, projData] = await Promise.all([
    admin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .in('status', ['nouveau', 'en_cours']),

    admin
      .from('interventions')
      .select('id, tech_user_id, tech_name')
      .eq('tenant_id', tenant_id)
      .gte('date_start', todayStart)
      .lte('date_start', todayEnd),

    admin
      .from('taches')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .neq('etat', 'terminee')
      .not('date_echeance', 'is', null)
      .lt('date_echeance', todayStr),

    admin
      .from('projects')
      .select('id, name, client_id, deadline, status, amount_ttc, clients(nom)')
      .eq('tenant_id', tenant_id)
      .in('status', ['nouveau', 'en_cours'])
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(6),
  ]);

  // Équipe aujourd'hui — group by tech_user_id
  const equipeMap = new Map<string, { name: string; count: number }>();
  for (const i of (intRes.data ?? [])) {
    if (i.tech_user_id) {
      const existing = equipeMap.get(i.tech_user_id);
      if (existing) { existing.count++; }
      else { equipeMap.set(i.tech_user_id, { name: i.tech_name ?? 'Technicien', count: 1 }); }
    }
  }
  const equipeAujourdhui = Array.from(equipeMap.entries()).map(([userId, v]) => ({
    userId, name: v.name, count: v.count,
  }));

  const chantiersEnCours = (projData.data ?? []).map((p) => ({
    id:         p.id,
    name:       p.name,
    clientNom:  (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
    deadline:   p.deadline  ?? null,
    status:     p.status,
    amount_ttc: (p.amount_ttc as number) ?? 0,
  }));

  return {
    projetsEnCours:     projRes.count ?? 0,
    interventionsToday: (intRes.data ?? []).length,
    tachesEnRetard:     tachRes.count ?? 0,
    techsActifs:        equipeMap.size,
    equipeAujourdhui,
    chantiersEnCours,
  };
}

// ── getCalendarEvents ──────────────────────────────────────────────────────────

export async function getCalendarEvents(
  startDate: string,
  endDate:   string,
): Promise<CalendarEventData[]> {
  const { admin, tenant_id } = await getAuthContext();

  const [intRes, projRes] = await Promise.all([
    admin
      .from('interventions')
      .select('id, title, date_start, date_end, status, client_id, tech_user_id, tech_name, project_id, notes, clients(nom)')
      .eq('tenant_id', tenant_id)
      .gte('date_start', startDate)
      .lte('date_start', endDate)
      .order('date_start'),

    admin
      .from('projects')
      .select('id, name, deadline, status, clients(nom)')
      .eq('tenant_id', tenant_id)
      .not('deadline', 'is', null)
      .gte('deadline', startDate)
      .lte('deadline', endDate),
  ]);

  const events: CalendarEventData[] = [];

  for (const i of (intRes.data ?? [])) {
    if (!i.date_start) continue;
    events.push({
      id:           i.id,
      title:        i.title ?? 'Intervention',
      startISO:     i.date_start,
      endISO:       i.date_end ?? i.date_start,
      type:         'intervention',
      status:       i.status ?? 'planifiee',
      color:        INTERVENTION_COLORS[i.status ?? 'planifiee'] ?? '#93c5fd',
      client_id:    i.client_id    ?? undefined,
      tech_user_id: i.tech_user_id ?? undefined,
      clientNom:    (i.clients as unknown as { nom: string } | null)?.nom,
      techNom:      i.tech_name ?? undefined,
      projectId:    i.project_id ?? undefined,
      notes:        i.notes     ?? undefined,
    });
  }

  for (const p of (projRes.data ?? [])) {
    if (!p.deadline) continue;
    events.push({
      id:        `proj-${p.id}`,
      title:     `📋 ${p.name}`,
      startISO:  p.deadline,
      endISO:    p.deadline,
      type:      'project',
      status:    p.status,
      color:     '#2563eb',
      clientNom: (p.clients as unknown as { nom: string } | null)?.nom,
    });
  }

  return events;
}

// ── createIntervention ─────────────────────────────────────────────────────────

export async function createIntervention(
  data: InterventionInput,
): Promise<{ id?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  // Dénormalisation client
  let clientName:    string | null = null;
  let clientAddress: string | null = null;
  let clientCity:    string | null = null;
  let clientPhone:   string | null = null;
  if (data.client_id) {
    const { data: cl } = await admin
      .from('clients')
      .select('nom, adresse, ville, tel')
      .eq('id', data.client_id)
      .single();
    clientName    = cl?.nom    ?? null;
    clientAddress = cl?.adresse ?? null;
    clientCity    = cl?.ville  ?? null;
    clientPhone   = cl?.tel    ?? null;
  }

  // Dénormalisation projet
  let affairNumber: string | null = null;
  if (data.project_id) {
    const { data: proj } = await admin
      .from('projects')
      .select('affair_number')
      .eq('id', data.project_id)
      .single();
    affairNumber = proj?.affair_number ?? null;
  }

  const { data: row, error } = await admin
    .from('interventions')
    .insert({
      tenant_id,
      title:          data.title,
      date_start:     data.date_start,
      date_end:       data.date_end      ?? null,
      client_id:      data.client_id     ?? null,
      project_id:     data.project_id    ?? null,
      tech_user_id:   data.tech_user_id  ?? null,
      tech_name:      data.tech_name     ?? null,
      status:         data.status        ?? 'planifiee',
      notes:          data.notes         ?? null,
      type:           data.type          ?? null,
      // backfill old columns for Technicien module compat
      statut:         data.status        ?? 'planifiee',
      technicien_id:  data.tech_user_id  ?? null,
      // is_new flag pour bandeau technicien
      is_new:         data.tech_user_id ? true : false,
      // champs dénormalisés
      client_name:    clientName,
      client_address: clientAddress,
      client_city:    clientCity,
      client_phone:   clientPhone,
      affair_number:  affairNumber,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath(PATH);
  return { id: row?.id };
}

// ── updateIntervention ─────────────────────────────────────────────────────────

export async function updateIntervention(
  id:   string,
  data: Partial<InterventionInput>,
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title        !== undefined) patch.title        = data.title;
  if (data.date_start   !== undefined) patch.date_start   = data.date_start;
  if (data.date_end     !== undefined) patch.date_end     = data.date_end;
  if (data.client_id    !== undefined) patch.client_id    = data.client_id;
  if (data.project_id   !== undefined) patch.project_id   = data.project_id;
  if (data.tech_user_id !== undefined) {
    patch.tech_user_id  = data.tech_user_id;
    patch.technicien_id = data.tech_user_id;
  }
  if (data.tech_name !== undefined) patch.tech_name = data.tech_name;
  if (data.status    !== undefined) {
    patch.status = data.status;
    patch.statut = data.status;
  }
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.type  !== undefined) patch.type  = data.type;

  const { error } = await admin
    .from('interventions')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return {};
}

// ── assignerTechnicienProjetAction (existant) ─────────────────────────────────

export async function assignerTechnicienProjetAction(
  projetId:     string,
  technicienId: string,
) {
  const { admin } = await getAuthContext();

  const { error } = await admin
    .from('taches')
    .update({ assigne_a: technicienId })
    .eq('projet_id', projetId)
    .is('assigne_a', null);

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return {};
}
