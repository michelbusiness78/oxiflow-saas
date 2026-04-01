'use server';

import { revalidatePath }               from 'next/cache';
import { getAuthContext }               from '@/lib/auth-context';
import { createAdminClient }            from '@/lib/supabase/server';

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
  // Nature / urgence
  nature?:      string;
  urgency?:     string;
}

export interface ProjectForPlanning {
  id:             string;
  name:           string;
  affair_number:  string | null;
  client_id:      string | null;
  client_nom:     string;
  client_address: string | null;
  client_city:    string | null;
  client_phone:   string | null;
}

export interface DashboardData {
  projetsEnCours:     number;
  interventionsToday: number;
  tachesEnRetard:     number;
  techsActifs:        number;
  equipeAujourdhui:   { userId: string; name: string; count: number }[];
  chantiersEnCours:   {
    id:          string;
    name:        string;
    clientNom:   string;
    deadline:    string | null;
    status:      string;
    amount_ttc:  number;
    tasksDone:   number;
    tasksTotal:  number;
  }[];
}

export interface OverdueTaskItem {
  id:           string;
  name:         string;
  due:          string;
  project_id:   string;
  project_name: string;
  priority:     string;
}

export interface ProjectDetailData {
  id:                string;
  name:              string;
  description:       string | null;
  status:            string;
  affair_number:     string | null;
  quote_number:      string | null;
  quote_id:          string | null;
  client_id:         string | null;
  deadline:          string | null;
  amount_ttc:        number;
  type:              string | null;
  notes:             string | null;
  purchase_amount:   number | null;
  hours_sold:        number | null;
  installer_name:    string | null;
  installer_ref:     string | null;
  installer_contact: string | null;
  supplier_name:     string | null;
  materials:         string[];
  reminder_time:     string | null;
  reminder_email:    string | null;
  reminder_active:   boolean;
  // Joined client
  client_nom:     string;
  client_adresse: string | null;
  client_ville:   string | null;
  client_tel:     string | null;
  client_email:   string | null;
  client_contact: string | null;
  // Computed
  hours_planned:  number;
}

export interface InterventionInput {
  title:              string;
  date_start:         string;   // ISO
  date_end?:          string;   // ISO
  client_id?:         string;
  project_id?:        string;
  tech_user_id?:      string;
  tech_name?:         string;
  status?:            string;
  notes?:             string;
  type?:              string;
  // Nature Projet / SAV
  nature?:            string;   // 'projet' | 'sav'
  type_intervention?: string;   // 'reseau' | 'securite' | 'telephonie' | 'informatique' | 'autre'
  urgency?:           string;   // 'normal' | 'urgent' | 'critique'
  hours_planned?:     number;
  under_contract?:    boolean;
  observations?:      string;   // description problème SAV (visible technicien)
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

  const [projRes, intRes, tachRes, projData, ptaskRes] = await Promise.all([
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

    // Tâches project_tasks en retard
    admin
      .from('project_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('done', false)
      .not('due', 'is', null)
      .lt('due', todayStr),
  ]);

  // Comptes de tâches par projet pour les chantiers en cours
  const projectIds = (projData.data ?? []).map((p) => p.id);
  let taskRows: { project_id: string; done: boolean }[] = [];
  if (projectIds.length > 0) {
    const { data: tr } = await admin
      .from('project_tasks')
      .select('project_id, done')
      .eq('tenant_id', tenant_id)
      .in('project_id', projectIds);
    taskRows = (tr ?? []) as { project_id: string; done: boolean }[];
  }

  const taskCountMap = new Map<string, { done: number; total: number }>();
  for (const t of taskRows) {
    const cur = taskCountMap.get(t.project_id) ?? { done: 0, total: 0 };
    cur.total++;
    if (t.done) cur.done++;
    taskCountMap.set(t.project_id, cur);
  }

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

  const chantiersEnCours = (projData.data ?? []).map((p) => {
    const tc = taskCountMap.get(p.id) ?? { done: 0, total: 0 };
    return {
      id:         p.id,
      name:       p.name,
      clientNom:  (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
      deadline:   p.deadline  ?? null,
      status:     p.status,
      amount_ttc: (p.amount_ttc as number) ?? 0,
      tasksDone:  tc.done,
      tasksTotal: tc.total,
    };
  });

  return {
    projetsEnCours:     projRes.count ?? 0,
    interventionsToday: (intRes.data ?? []).length,
    tachesEnRetard:     (tachRes.count ?? 0) + (ptaskRes.count ?? 0),
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
      .select('id, title, date_start, date_end, status, client_id, tech_user_id, tech_name, project_id, notes, nature, urgency, clients(nom)')
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
    const nature  = (i as unknown as { nature?: string }).nature;
    const urgency = (i as unknown as { urgency?: string }).urgency;

    // Couleur : SAV → jaune/orange/rouge selon urgence, Projet → bleu/orange/vert selon statut
    let color: string;
    if (nature === 'sav') {
      if (urgency === 'critique') color = '#fca5a5'; // red-300
      else if (urgency === 'urgent') color = '#fdba74'; // orange-300
      else color = '#fde68a'; // amber-200
    } else {
      color = INTERVENTION_COLORS[i.status ?? 'planifiee'] ?? '#93c5fd';
    }

    events.push({
      id:           i.id,
      title:        i.title ?? 'Intervention',
      startISO:     i.date_start,
      endISO:       i.date_end ?? i.date_start,
      type:         'intervention',
      status:       i.status ?? 'planifiee',
      color,
      client_id:    i.client_id    ?? undefined,
      tech_user_id: i.tech_user_id ?? undefined,
      clientNom:    (i.clients as unknown as { nom: string } | null)?.nom,
      techNom:      i.tech_name ?? undefined,
      projectId:    i.project_id ?? undefined,
      notes:        i.notes     ?? undefined,
      nature:       nature ?? 'projet',
      urgency:      urgency ?? 'normal',
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

  // Dénormalisation projet + matériel depuis devis
  let affairNumber:      string | null = null;
  let materialsFromDevis: Record<string, unknown>[] = [];

  if (data.project_id) {
    const { data: proj } = await admin
      .from('projects')
      .select('affair_number, quote_id')
      .eq('id', data.project_id)
      .single();

    affairNumber = proj?.affair_number ?? null;

    // Injecter les lignes du devis comme matériel pré-rempli
    if (proj?.quote_id) {
      const { data: quote } = await admin
        .from('quotes')
        .select('lignes')
        .eq('id', proj.quote_id)
        .single();

      const lignes = (quote?.lignes as Array<{
        id?: string;
        reference?: string;
        designation?: string;
        quantite?: number;
      }> | null) ?? [];

      materialsFromDevis = lignes.map((l) => ({
        id:          crypto.randomUUID(),
        designation: l.designation ?? '',
        reference:   l.reference   ?? '',
        quantite:    l.quantite    ?? 1,
        marque:      '',
        modele:      '',
        serial:      '',
        location:    '',
        from_devis:  true,
      }));
    }
  }

  const { data: row, error } = await admin
    .from('interventions')
    .insert({
      tenant_id,
      title:               data.title,
      date_start:          data.date_start,
      date_end:            data.date_end      ?? null,
      client_id:           data.client_id     ?? null,
      project_id:          data.project_id    ?? null,
      tech_user_id:        data.tech_user_id  ?? null,
      tech_name:           data.tech_name     ?? null,
      status:              data.status        ?? 'planifiee',
      notes:               data.notes         ?? null,
      type:                data.type          ?? null,
      // backfill old columns for Technicien module compat
      statut:              data.status        ?? 'planifiee',
      technicien_id:       data.tech_user_id  ?? null,
      // is_new flag pour bandeau technicien
      is_new:              data.tech_user_id ? true : false,
      // champs dénormalisés
      client_name:         clientName,
      client_address:      clientAddress,
      client_city:         clientCity,
      client_phone:        clientPhone,
      affair_number:       affairNumber,
      // matériel pré-rempli depuis le devis (uniquement pour les projets)
      materials_installed: materialsFromDevis,
      // Nature / SAV
      nature:              data.nature            ?? 'projet',
      type_intervention:   data.type_intervention ?? null,
      urgency:             data.urgency           ?? 'normal',
      hours_planned:       data.hours_planned     ?? null,
      under_contract:      data.under_contract    ?? false,
      observations:        data.observations      ?? null,
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

// ── getProjectsForPlanning ─────────────────────────────────────────────────────

export async function getProjectsForPlanning(): Promise<ProjectForPlanning[]> {
  const { admin, tenant_id } = await getAuthContext();

  const { data } = await admin
    .from('projects')
    .select('id, name, affair_number, client_id, clients(nom, adresse, ville, tel)')
    .eq('tenant_id', tenant_id)
    .in('status', ['nouveau', 'en_cours'])
    .order('name');

  return (data ?? []).map((p) => {
    const cl = p.clients as unknown as {
      nom: string; adresse: string | null; ville: string | null; tel: string | null
    } | null;
    return {
      id:             p.id,
      name:           p.name,
      affair_number:  p.affair_number ?? null,
      client_id:      p.client_id     ?? null,
      client_nom:     cl?.nom         ?? '—',
      client_address: cl?.adresse     ?? null,
      client_city:    cl?.ville       ?? null,
      client_phone:   cl?.tel         ?? null,
    };
  });
}

// ── getContractedClientIds ────────────────────────────────────────────────────

export async function getContractedClientIds(): Promise<string[]> {
  const { admin, tenant_id } = await getAuthContext();
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data } = await admin
      .from('contrats')
      .select('client_id')
      .eq('tenant_id', tenant_id)
      .eq('actif', true)
      .or(`date_fin.is.null,date_fin.gte.${today}`);

    return (data ?? []).map((c: { client_id: string }) => c.client_id);
  } catch {
    return [];
  }
}

// ── getOverdueProjectTasks ────────────────────────────────────────────────────

export async function getOverdueProjectTasks(): Promise<OverdueTaskItem[]> {
  const { admin, tenant_id } = await getAuthContext();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: tasks } = await admin
    .from('project_tasks')
    .select('id, name, due, project_id, priority')
    .eq('tenant_id', tenant_id)
    .eq('done', false)
    .not('due', 'is', null)
    .lte('due', todayStr)
    .order('due');

  if (!tasks || tasks.length === 0) return [];

  const projectIds = [...new Set(tasks.map((t) => t.project_id as string))];
  const { data: projs } = await admin
    .from('projects')
    .select('id, name')
    .in('id', projectIds);

  const projMap = new Map((projs ?? []).map((p) => [p.id as string, p.name as string]));

  return tasks.map((t) => ({
    id:           t.id as string,
    name:         t.name as string,
    due:          t.due as string,
    project_id:   t.project_id as string,
    project_name: projMap.get(t.project_id as string) ?? '—',
    priority:     (t.priority as string) ?? 'mid',
  }));
}

// ── getProjectFull ────────────────────────────────────────────────────────────

export async function getProjectFull(
  projectId: string,
  tenantId:  string,
): Promise<ProjectDetailData | null> {
  const admin = createAdminClient();

  const [projRes, intRes] = await Promise.all([
    admin
      .from('projects')
      .select('id, name, description, status, affair_number, quote_number, quote_id, client_id, deadline, amount_ttc, type, notes, purchase_amount, hours_sold, installer_name, installer_ref, installer_contact, supplier_name, materials, reminder_time, reminder_email, reminder_active, clients(nom, adresse, ville, tel, email, contact)')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single(),

    admin
      .from('interventions')
      .select('hours_planned')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .not('hours_planned', 'is', null),
  ]);

  if (projRes.error || !projRes.data) return null;
  const p  = projRes.data;
  const cl = (p.clients as unknown as {
    nom: string; adresse: string | null; ville: string | null;
    tel: string | null; email: string | null; contact: string | null;
  } | null);

  const hoursPlanified = (intRes.data ?? []).reduce(
    (sum, i) => sum + ((i.hours_planned as number | null) ?? 0), 0,
  );

  const rawMaterials = (p.materials as unknown as string[] | null) ?? [];

  return {
    id:                p.id,
    name:              p.name,
    description:       (p.description as string | null) ?? null,
    status:            (p.status as string) ?? 'nouveau',
    affair_number:     (p.affair_number as string | null) ?? null,
    quote_number:      (p.quote_number as string | null) ?? null,
    quote_id:          (p.quote_id as string | null) ?? null,
    client_id:         (p.client_id as string | null) ?? null,
    deadline:          (p.deadline as string | null) ?? null,
    amount_ttc:        (p.amount_ttc as number) ?? 0,
    type:              (p.type as string | null) ?? null,
    notes:             (p.notes as string | null) ?? null,
    purchase_amount:   (p as unknown as { purchase_amount?: number | null }).purchase_amount ?? null,
    hours_sold:        (p as unknown as { hours_sold?: number | null }).hours_sold ?? null,
    installer_name:    (p as unknown as { installer_name?: string | null }).installer_name ?? null,
    installer_ref:     (p as unknown as { installer_ref?: string | null }).installer_ref ?? null,
    installer_contact: (p as unknown as { installer_contact?: string | null }).installer_contact ?? null,
    supplier_name:     (p as unknown as { supplier_name?: string | null }).supplier_name ?? null,
    materials:         rawMaterials,
    reminder_time:     (p as unknown as { reminder_time?: string | null }).reminder_time ?? null,
    reminder_email:    (p as unknown as { reminder_email?: string | null }).reminder_email ?? null,
    reminder_active:   (p as unknown as { reminder_active?: boolean }).reminder_active ?? false,
    client_nom:        cl?.nom     ?? '—',
    client_adresse:    cl?.adresse ?? null,
    client_ville:      cl?.ville   ?? null,
    client_tel:        cl?.tel     ?? null,
    client_email:      cl?.email   ?? null,
    client_contact:    cl?.contact ?? null,
    hours_planned:     Math.round(hoursPlanified * 10) / 10,
  };
}

// ── saveProjectDetail ─────────────────────────────────────────────────────────

export async function saveProjectDetail(
  projectId: string,
  tenantId:  string,
  data: {
    name?:              string;
    description?:       string | null;
    status?:            string;
    deadline?:          string | null;
    type?:              string | null;
    notes?:             string | null;
    purchase_amount?:   number | null;
    hours_sold?:        number | null;
    installer_name?:    string | null;
    installer_ref?:     string | null;
    installer_contact?: string | null;
    supplier_name?:     string | null;
    materials?:         string[];
    reminder_time?:     string | null;
    reminder_email?:    string | null;
    reminder_active?:   boolean;
  },
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('projects')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('tenant_id', tenantId);
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
