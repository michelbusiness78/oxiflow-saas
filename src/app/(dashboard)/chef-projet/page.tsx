import { redirect }         from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProjectDetailFull }  from '@/components/chef-projet/ProjectDetailFull';
import { ProjectsTab }        from '@/components/chef-projet/ProjectsTab';
import { ChefProjetNav }      from '@/components/chef-projet/ChefProjetNav';
import { TechniciensTab }     from '@/components/chef-projet/TechniciensTab';
import { ChefDashboardV2 }    from '@/components/chef-projet/ChefDashboardV2';
import { CalendarView }       from '@/components/chef-projet/CalendarView';
import { SAVTab }             from '@/components/chef-projet/SAVTab';
import { getProjects }        from '@/app/actions/projects';
import {
  getDashboardChefProjet,
  getCalendarEvents,
  getProjectsForPlanning,
  getContractedClientIds,
  getProjectFull,
} from '@/app/actions/chef-projet';
import { getProjectTasks }    from '@/app/actions/project-tasks';
import type { TechnicienWithStats } from '@/components/chef-projet/TechniciensTab';
import type { SAVTicketFull }       from '@/components/chef-projet/SAVTab';

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ project?: string; tab?: string; filter?: string }>;
}

export default async function ChefProjetPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin     = createAdminClient();
  const profileRes = await admin.from('users').select('name, tenant_id').eq('id', user.id).single();
  const userName  = profileRes.data?.name      ?? user.email ?? 'Chef de projet';
  const tenantId  = profileRes.data?.tenant_id ?? null;

  const params      = await searchParams;
  const projectId   = params?.project;
  const activeTab   = params?.tab    ?? 'dashboard';
  const tabFilter   = params?.filter ?? undefined;

  // ── Vue détail projet (?project=ID) ───────────────────────────────────────────

  if (projectId && tenantId) {
    const [project, tasks] = await Promise.all([
      getProjectFull(projectId, tenantId),
      getProjectTasks(projectId, tenantId),
    ]);
    if (!project) redirect('/chef-projet');
    return (
      <ProjectDetailFull project={project} tasks={tasks} tenantId={tenantId} />
    );
  }

  // ── Plage calendrier (semaine courante) ───────────────────────────────────────

  const now    = new Date();
  const monday = new Date(now);
  const day    = now.getDay();
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ── Fetch parallèle ───────────────────────────────────────────────────────────

  const [
    dashData,
    allProjects,
    usersRes,
    initialEvents,
    projectsForPlanning,
    contractedIds,
    clientsRes,
    techniciensRes,
    savRes,
    contratsRes,
  ] = await Promise.all([
    getDashboardChefProjet(),
    tenantId ? getProjects(tenantId) : Promise.resolve([]),
    admin.from('users').select('id, name, email').order('name'),
    getCalendarEvents(monday.toISOString(), sunday.toISOString()),
    getProjectsForPlanning(),
    getContractedClientIds(),
    tenantId
      ? admin.from('clients').select('id, nom, adresse, ville, tel').eq('tenant_id', tenantId).order('nom')
      : admin.from('clients').select('id, nom, adresse, ville, tel').order('nom'),
    tenantId
      ? admin.from('users').select('id, name, email, color').eq('role', 'technicien').eq('tenant_id', tenantId).order('name')
      : admin.from('users').select('id, name, email, color').eq('role', 'technicien').order('name'),
    // SAV tickets : on utilise * pour éviter "column does not exist" sur les colonnes
    // optionnelles (titre, assigne_a, project_id, resolution_notes — migration 022).
    // Le join clients(nom) est safe car la FK existe depuis migration 001.
    tenantId
      ? admin
          .from('sav_tickets')
          .select('*, clients(nom)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Contrats pour le sélecteur du formulaire SAV
    tenantId
      ? admin
          .from('contrats')
          .select('id, type, nom, numero, client_id, actif')
          .eq('tenant_id', tenantId)
          .eq('actif', true)
          .order('nom')
      : Promise.resolve({ data: [] }),
  ]);

  // ── Task counts pour cartes projets ──────────────────────────────────────────

  const taskCountsMap: Record<string, { done: number; total: number }> = {};
  if (tenantId && allProjects.length > 0) {
    try {
      const projectIds = allProjects.map((p) => p.id);
      const { data: taskRows } = await admin
        .from('project_tasks')
        .select('project_id, done')
        .eq('tenant_id', tenantId)
        .in('project_id', projectIds);
      for (const t of (taskRows ?? [])) {
        const id = t.project_id as string;
        if (!taskCountsMap[id]) taskCountsMap[id] = { done: 0, total: 0 };
        taskCountsMap[id].total++;
        if (t.done) taskCountsMap[id].done++;
      }
    } catch { /* table absente */ }
  }

  // ── Interventions actives par technicien ──────────────────────────────────────

  const interventionCountMap: Record<string, number> = {};
  if (tenantId) {
    try {
      const { data: activeInter } = await admin
        .from('interventions')
        .select('assigne_a')
        .eq('tenant_id', tenantId)
        .eq('statut', 'en_cours');
      for (const i of (activeInter ?? [])) {
        const id = i.assigne_a as string | null;
        if (id) interventionCountMap[id] = (interventionCountMap[id] ?? 0) + 1;
      }
    } catch { /* table absente */ }
  }

  // ── Mapping des données ───────────────────────────────────────────────────────

  const usersPlain = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));

  const clientsForModal = (clientsRes.data ?? []).map((c) => ({
    id:      c.id,
    nom:     c.nom as string,
    adresse: (c as unknown as { adresse?: string }).adresse ?? null,
    ville:   (c as unknown as { ville?: string }).ville   ?? null,
    tel:     (c as unknown as { tel?: string }).tel       ?? null,
  }));

  const clientsSimple = (clientsRes.data ?? []).map((c) => ({ id: c.id, nom: c.nom as string }));

  const techniciens = (techniciensRes.data ?? []).map((u) => ({
    id:    u.id,
    name:  u.name as string,
    color: (u as unknown as { color?: string }).color ?? null,
  }));

  // TechniciensTab data
  const techProjectMap: Record<string, string[]> = {};
  for (const p of allProjects) {
    if (p.chef_projet_user_id) {
      if (!techProjectMap[p.chef_projet_user_id]) techProjectMap[p.chef_projet_user_id] = [];
      techProjectMap[p.chef_projet_user_id].push(p.name);
    }
  }

  const techniciensWithStats: TechnicienWithStats[] = (techniciensRes.data ?? []).map((u) => ({
    id:                   u.id,
    name:                 u.name as string,
    color:                (u as unknown as { color?: string }).color ?? null,
    email:                (u as unknown as { email?: string }).email ?? null,
    interventionsActives: interventionCountMap[u.id] ?? 0,
    projetsAssignes:      techProjectMap[u.id] ?? [],
  }));

  // SAV tickets — mapping robuste
  // Les colonnes optionnelles (titre, assigne_a, project_id, resolution_notes)
  // peuvent être absentes avant la migration 022 → on utilise ?? null systématiquement.
  // project_nom est résolu côté client via allProjects (pas de join projects dans le SELECT).
  const projectsMap = new Map(allProjects.map((p) => [p.id, p.name]));

  const savTickets: SAVTicketFull[] = (savRes.data ?? []).map((t: unknown) => {
    const row        = t as Record<string, unknown>;
    const clientNom  = (row.clients as { nom: string } | null)?.nom ?? '—';
    const projectId  = (row.project_id as string | null) ?? null;
    const assigneId  = (row.assigne_a  as string | null) ?? null;
    const assigneUser = usersPlain.find((u) => u.id === assigneId);
    return {
      id:               row.id as string,
      client_id:        row.client_id as string,
      project_id:       projectId,
      contrat_id:       (row.contrat_id as string | null) ?? null,
      assigne_a:        assigneId,
      titre:            (row.titre as string | null) ?? null,
      description:      (row.description as string)  ?? '',
      priorite:         (row.priorite as SAVTicketFull['priorite']) ?? 'normale',
      statut:           (row.statut   as SAVTicketFull['statut'])   ?? 'ouvert',
      date_ouverture:   row.date_ouverture as string,
      date_resolution:  (row.date_resolution  as string | null) ?? null,
      resolution_notes: (row.resolution_notes as string | null) ?? null,
      created_at:       row.created_at as string,
      client_nom:       clientNom,
      project_nom:      projectId ? (projectsMap.get(projectId) ?? null) : null,
      assigne_nom:      assigneUser?.name ?? null,
    };
  });

  const projectsForSAV = allProjects.map((p) => ({ id: p.id, name: p.name }));
  const technicienRefs = techniciens.map((t) => ({ id: t.id, name: t.name }));
  const contratsForSAV = (contratsRes.data ?? []).map((c: unknown) => {
    const row = c as Record<string, unknown>;
    return {
      id:        row.id as string,
      type:      row.type as string,
      nom:       (row.nom as string | null) ?? null,
      numero:    (row.numero as string | null) ?? null,
      client_id: row.client_id as string,
      actif:     (row.actif as boolean) ?? true,
    };
  });

  // Open tickets count for nav badge
  const openTicketCount = savTickets.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours').length;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Chef de Projet</h1>
        <p className="mt-0.5 text-sm text-slate-500">{userName}</p>
      </div>

      {/* Layout sidebar + contenu */}
      <div className="flex gap-6 items-start">
        <ChefProjetNav activeTab={activeTab} notifCount={openTicketCount} />

        {/* Zone de contenu */}
        <div className="flex-1 min-w-0 pb-24 md:pb-0 space-y-4">

          {/* ── TABLEAU DE BORD ── */}
          {activeTab === 'dashboard' && (
            <ChefDashboardV2 data={dashData} />
          )}

          {/* ── PLANNING ── */}
          {activeTab === 'planning' && (
            <CalendarView
              initialEvents={initialEvents}
              clients={clientsForModal}
              techniciens={techniciens}
              projects={projectsForPlanning}
              contractedClientIds={contractedIds}
            />
          )}

          {/* ── PROJETS ── */}
          {activeTab === 'projets' && (
            <ProjectsTab
              projects={allProjects}
              users={usersPlain}
              taskCounts={taskCountsMap}
              clients={clientsSimple}
            />
          )}

          {/* ── SAV / TICKETS ── */}
          {activeTab === 'sav' && (
            <SAVTab
              tickets={savTickets}
              clients={clientsSimple}
              projects={projectsForSAV}
              techniciens={technicienRefs}
              contrats={contratsForSAV}
              defaultFilter={tabFilter}
            />
          )}

          {/* ── TECHNICIENS ── */}
          {activeTab === 'techniciens' && (
            <TechniciensTab techniciens={techniciensWithStats} />
          )}

        </div>
      </div>
    </div>
  );
}
