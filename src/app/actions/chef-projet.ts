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
  quote_materials:   string[];   // matériel auto depuis le devis (non supprimable)
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

  // project_tasks : table optionnelle (peut ne pas encore exister)
  let ptaskCount = 0;
  let taskRows: { project_id: string; done: boolean }[] = [];
  try {
    const projectIds = (projData.data ?? []).map((p) => p.id as string);
    const [ptaskRes, ptaskDetailRes] = await Promise.all([
      admin
        .from('project_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .eq('done', false)
        .not('due', 'is', null)
        .lt('due', todayStr),
      projectIds.length > 0
        ? admin
            .from('project_tasks')
            .select('project_id, done')
            .eq('tenant_id', tenant_id)
            .in('project_id', projectIds)
        : Promise.resolve({ data: [] as { project_id: string; done: boolean }[] }),
    ]);
    ptaskCount = ptaskRes.count ?? 0;
    taskRows   = (ptaskDetailRes.data ?? []) as { project_id: string; done: boolean }[];
  } catch {
    // table project_tasks absente — on ignore silencieusement
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
    tachesEnRetard:     (tachRes.count ?? 0) + ptaskCount,
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
      // Toutes interventions qui chevauchent la plage [startDate, endDate]
      .lte('date_start', endDate)
      .or(`date_end.gte.${startDate},and(date_end.is.null,date_start.gte.${startDate})`)
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
  try {
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
  } catch {
    return [];
  }
}

// ── getProjectFull ────────────────────────────────────────────────────────────

const BASE_PROJECT_SELECT = 'id, name, description, status, affair_number, quote_number, quote_id, client_id, deadline, amount_ttc, type, notes, clients(nom, adresse, ville, tel, email, contact)';
const FULL_PROJECT_SELECT = `${BASE_PROJECT_SELECT}, purchase_amount, hours_sold, installer_name, installer_ref, installer_contact, supplier_name, materials, reminder_time, reminder_email, reminder_active`;

export async function getProjectFull(
  projectId: string,
  tenantId:  string,
): Promise<ProjectDetailData | null> {
  const admin = createAdminClient();

  // Try full select first; fall back to base columns if new columns don't exist yet
  let projData: Record<string, unknown> | null = null;
  let hasExtendedCols = true;

  try {
    const [projRes, intRes] = await Promise.all([
      admin
        .from('projects')
        .select(FULL_PROJECT_SELECT)
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

    if (projRes.error) {
      // Possibly missing columns — retry with base select
      throw projRes.error;
    }
    if (!projRes.data) return null;
    projData = projRes.data as unknown as Record<string, unknown>;

    const cl = (projData.clients as unknown as {
      nom: string; adresse: string | null; ville: string | null;
      tel: string | null; email: string | null; contact: string | null;
    } | null);

    const hoursPlanified = (intRes.data ?? []).reduce(
      (sum, i) => sum + ((i.hours_planned as number | null) ?? 0), 0,
    );

    const rawMaterials = (projData.materials as string[] | null) ?? [];

    // Récupère les lignes matériel du devis lié
    let quoteMaterials: string[] = [];
    const quoteId = projData.quote_id as string | null;
    if (quoteId) {
      const { data: quoteData } = await admin
        .from('quotes')
        .select('lignes')
        .eq('id', quoteId)
        .single();
      if (quoteData?.lignes) {
        const lignes = quoteData.lignes as Array<{ designation?: string; type?: string; quantite?: number }>;
        quoteMaterials = lignes
          .filter((l) => !l.type || l.type === 'materiel' || l.type === 'forfait')
          .map((l) => {
            const d = l.designation ?? '';
            if (!d) return '';
            const q = l.quantite ?? 1;
            return q > 1 ? `${d} × ${q}` : d;
          })
          .filter(Boolean);
      }
    }

    return {
      id:                projData.id as string,
      name:              projData.name as string,
      description:       (projData.description as string | null) ?? null,
      status:            (projData.status as string) ?? 'nouveau',
      affair_number:     (projData.affair_number as string | null) ?? null,
      quote_number:      (projData.quote_number as string | null) ?? null,
      quote_id:          (projData.quote_id as string | null) ?? null,
      client_id:         (projData.client_id as string | null) ?? null,
      deadline:          (projData.deadline as string | null) ?? null,
      amount_ttc:        (projData.amount_ttc as number) ?? 0,
      type:              (projData.type as string | null) ?? null,
      notes:             (projData.notes as string | null) ?? null,
      purchase_amount:   (projData.purchase_amount as number | null) ?? null,
      hours_sold:        (projData.hours_sold as number | null) ?? null,
      installer_name:    (projData.installer_name as string | null) ?? null,
      installer_ref:     (projData.installer_ref as string | null) ?? null,
      installer_contact: (projData.installer_contact as string | null) ?? null,
      supplier_name:     (projData.supplier_name as string | null) ?? null,
      materials:         rawMaterials,
      quote_materials:   quoteMaterials,
      reminder_time:     (projData.reminder_time as string | null) ?? null,
      reminder_email:    (projData.reminder_email as string | null) ?? null,
      reminder_active:   (projData.reminder_active as boolean) ?? false,
      client_nom:        cl?.nom     ?? '—',
      client_adresse:    cl?.adresse ?? null,
      client_ville:      cl?.ville   ?? null,
      client_tel:        cl?.tel     ?? null,
      client_email:      cl?.email   ?? null,
      client_contact:    cl?.contact ?? null,
      hours_planned:     Math.round(hoursPlanified * 10) / 10,
    };
  } catch {
    hasExtendedCols = false;
  }

  // Fallback: base columns only (new columns not yet migrated)
  if (!hasExtendedCols) {
    const [projRes, intRes] = await Promise.all([
      admin
        .from('projects')
        .select(BASE_PROJECT_SELECT)
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
    const p  = projRes.data as unknown as Record<string, unknown>;
    const cl = (p.clients as unknown as {
      nom: string; adresse: string | null; ville: string | null;
      tel: string | null; email: string | null; contact: string | null;
    } | null);

    const hoursPlanified = (intRes.data ?? []).reduce(
      (sum, i) => sum + ((i.hours_planned as number | null) ?? 0), 0,
    );

    return {
      id:                p.id as string,
      name:              p.name as string,
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
      purchase_amount:   null,
      hours_sold:        null,
      installer_name:    null,
      installer_ref:     null,
      installer_contact: null,
      supplier_name:     null,
      materials:         [],
      quote_materials:   [],
      reminder_time:     null,
      reminder_email:    null,
      reminder_active:   false,
      client_nom:        cl?.nom     ?? '—',
      client_adresse:    cl?.adresse ?? null,
      client_ville:      cl?.ville   ?? null,
      client_tel:        cl?.tel     ?? null,
      client_email:      cl?.email   ?? null,
      client_contact:    cl?.contact ?? null,
      hours_planned:     Math.round(hoursPlanified * 10) / 10,
    };
  }

  return null;
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
