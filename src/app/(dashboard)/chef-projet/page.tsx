import { redirect }         from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProjectDetailFull }  from '@/components/chef-projet/ProjectDetailFull';
import { ProjectList }        from '@/components/projets/ProjectList';
import { ChefDashboardV2 }    from '@/components/chef-projet/ChefDashboardV2';
import { CalendarView }       from '@/components/chef-projet/CalendarView';
import { getMyProjects }      from '@/app/actions/projects';
import {
  getDashboardChefProjet,
  getCalendarEvents,
  getProjectsForPlanning,
  getContractedClientIds,
  getProjectFull,
} from '@/app/actions/chef-projet';
import { getProjectTasks } from '@/app/actions/project-tasks';

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ project?: string; tab?: string }>;
}

export default async function ChefProjetPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const profileRes = await admin.from('users').select('name, tenant_id').eq('id', user.id).single();
  const userName = profileRes.data?.name      ?? user.email ?? 'Chef de projet';
  const tenantId = profileRes.data?.tenant_id ?? null;

  const params    = await searchParams;
  const projectId = params?.project;
  const activeTab = params?.tab ?? 'dashboard';

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

  // ── Plage calendrier initiale (semaine courante) ──────────────────────────────

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
    projectsR4,
    usersRes,
    initialEvents,
    projectsForPlanning,
    contractedIds,
    clientsRes,
    techniciensRes,
  ] = await Promise.all([
    getDashboardChefProjet(),
    tenantId ? getMyProjects(tenantId, user.id) : Promise.resolve([]),
    admin.from('users').select('id, name').order('name'),
    getCalendarEvents(monday.toISOString(), sunday.toISOString()),
    getProjectsForPlanning(),
    getContractedClientIds(),
    tenantId
      ? admin.from('clients').select('id, nom, adresse, ville, tel').eq('tenant_id', tenantId).order('nom')
      : admin.from('clients').select('id, nom, adresse, ville, tel').order('nom'),
    tenantId
      ? admin.from('users').select('id, name, color').eq('role', 'technicien').eq('tenant_id', tenantId).order('name')
      : admin.from('users').select('id, name, color').eq('role', 'technicien').order('name'),
  ]);

  // Task counts pour les cartes ProjectList
  const taskCountsMap: Record<string, { done: number; total: number }> = {};
  if (tenantId && projectsR4.length > 0) {
    try {
      const projectIds = projectsR4.map((p) => p.id);
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
    } catch {
      // table project_tasks absente — on ignore
    }
  }

  const usersPlain = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));

  const clientsForModal = (clientsRes.data ?? []).map((c) => ({
    id:      c.id,
    nom:     c.nom as string,
    adresse: (c as unknown as { adresse?: string }).adresse ?? null,
    ville:   (c as unknown as { ville?: string }).ville   ?? null,
    tel:     (c as unknown as { tel?: string }).tel     ?? null,
  }));

  const techniciens = (techniciensRes.data ?? []).map((u) => ({
    id:    u.id,
    name:  u.name as string,
    color: (u as unknown as { color?: string }).color ?? null,
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Chef de Projet</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {userName}
          {projectsR4.length > 0 && (
            ` · ${projectsR4.length} projet${projectsR4.length !== 1 ? 's' : ''} assigné${projectsR4.length !== 1 ? 's' : ''}`
          )}
        </p>
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {[
            { key: 'dashboard', label: 'Tableau de bord' },
            { key: 'planning',  label: 'Planning'        },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`/chef-projet?tab=${key}`}
              className={[
                'whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      {/* Tableau de bord */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {projectsR4.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">
                Mes projets assignés
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {projectsR4.length}
                </span>
              </h2>
              <ProjectList
                projects={projectsR4}
                users={usersPlain}
                taskCounts={taskCountsMap}
                detailBaseUrl="/chef-projet?project="
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
              Aucun projet assigné pour le moment
            </div>
          )}

          <ChefDashboardV2 data={dashData} />
        </div>
      )}

      {/* Planning */}
      {activeTab === 'planning' && (
        <CalendarView
          initialEvents={initialEvents}
          clients={clientsForModal}
          techniciens={techniciens}
          projects={projectsForPlanning}
          contractedClientIds={contractedIds}
        />
      )}
    </div>
  );
}
