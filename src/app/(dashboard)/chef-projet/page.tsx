import { redirect }    from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProjetDetail }    from '@/components/chef-projet/ProjetDetail';
import { ProjectList }     from '@/components/projets/ProjectList';
import { ProjetList }      from '@/components/chef-projet/ProjetList';
import { ChefDashboard }   from '@/components/chef-projet/ChefDashboard';
import { ChefDashboardV2 } from '@/components/chef-projet/ChefDashboardV2';
import { CalendarView }    from '@/components/chef-projet/CalendarView';
import { getMyProjects }   from '@/app/actions/projects';
import { getDashboardChefProjet, getCalendarEvents, getProjectsForPlanning, getContractedClientIds } from '@/app/actions/chef-projet';
import type { Tache } from '@/components/projets/TacheForm';

// ─── Legacy fetch (gardé pour la vue détail et ProjetList) ────────────────────

async function fetchLegacyData(userId: string) {
  const supabase = await createClient();

  const [projetsRes, tachesRes, interventionsRes, clientsRes, techniciensRes, allUsersRes] =
    await Promise.all([
      supabase
        .from('projets')
        .select('id, nom, statut, date_debut, date_fin_prevue, pct_avancement, montant_ht, client_id, chef_projet_id, created_at, updated_at, clients(nom), users(name)')
        .eq('chef_projet_id', userId)
        .order('created_at', { ascending: false }),

      supabase
        .from('taches')
        .select('id, projet_id, titre, description, assigne_a, priorite, etat, date_echeance, pct_avancement, created_at, projets(nom), users(name)')
        .order('date_echeance', { ascending: true, nullsFirst: false }),

      supabase
        .from('interventions')
        .select('id, projet_id, technicien_id, date, type, statut, duree_minutes, clients(nom), users(name)')
        .order('date', { ascending: false }),

      supabase.from('clients').select('id, nom, adresse, ville, tel').order('nom'),
      supabase.from('users').select('id, name').eq('role', 'technicien').order('name'),
      supabase.from('users').select('id, name').order('name'),
    ]);

  const projets = (projetsRes.data ?? []).map((p) => ({
    id:              p.id,
    nom:             p.nom,
    statut:          p.statut,
    date_debut:      p.date_debut      ?? null,
    date_fin_prevue: p.date_fin_prevue ?? null,
    pct_avancement:  p.pct_avancement,
    montant_ht:      p.montant_ht      ?? null,
    client_id:       p.client_id,
    client_nom:      (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
    chef_nom:        (p.users   as unknown as { name: string } | null)?.name ?? '—',
    updated_at:      (p as unknown as { updated_at?: string }).updated_at ?? p.created_at,
  }));

  const projetIds = new Set(projets.map((p) => p.id));

  const taches = (tachesRes.data ?? [])
    .filter((t) => t.projet_id && projetIds.has(t.projet_id))
    .map((t) => ({
      ...t,
      description:   t.description   ?? null,
      assigne_a:     t.assigne_a     ?? null,
      date_echeance: t.date_echeance ?? null,
      projet_nom:    (t.projets as unknown as { nom: string } | null)?.nom,
      assigne_nom:   (t.users   as unknown as { name: string } | null)?.name,
    })) as (Tache & { projet_nom?: string; assigne_nom?: string })[];

  const interventions = (interventionsRes.data ?? [])
    .filter((i) => i.projet_id && projetIds.has(i.projet_id))
    .map((i) => ({
      id:             i.id,
      projet_id:      i.projet_id,
      date:           i.date,
      type:           i.type,
      statut:         i.statut,
      duree_minutes:  i.duree_minutes ?? null,
      technicien_nom: (i.users as unknown as { name: string } | null)?.name ?? '—',
    }));

  return {
    projets,
    taches,
    interventions,
    clients:     clientsRes.data     ?? [],
    techniciens: (techniciensRes.data ?? []).map((u) => ({ id: u.id, name: u.name })),
    allUsers:    (allUsersRes.data    ?? []).map((u) => ({ id: u.id, nom: u.name, prenom: '' })),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ projet?: string; tab?: string }>;
}

export default async function ChefProjetPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();
  const profileRes = await admin.from('users').select('name, tenant_id').eq('id', user.id).single();
  const userName = profileRes.data?.name      ?? user.email ?? 'Chef de projet';
  const tenantId = profileRes.data?.tenant_id ?? null;

  const params   = await searchParams;
  const projetId = params?.projet;
  const activeTab = params?.tab ?? 'dashboard';

  // ── Vue détail (inchangée) ──────────────────────────────────────────────────

  if (projetId) {
    const legacyData = await fetchLegacyData(user.id);
    const projet = legacyData.projets.find((p) => p.id === projetId);
    if (!projet) redirect('/chef-projet');

    return (
      <ProjetDetail
        projet={projet}
        taches={legacyData.taches.filter((t) => t.projet_id === projetId)}
        interventions={legacyData.interventions.filter((i) => i.projet_id === projetId)}
        users={legacyData.allUsers}
        techniciens={legacyData.techniciens}
      />
    );
  }

  // ── Calcul de la plage calendrier initiale (semaine courante) ───────────────

  const now    = new Date();
  const monday = new Date(now);
  const day    = now.getDay();
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ── Fetch parallèle ─────────────────────────────────────────────────────────

  const [legacyData, dashData, projectsR4, usersRes, initialEvents, projectsForPlanning, contractedIds] = await Promise.all([
    fetchLegacyData(user.id),
    getDashboardChefProjet(),
    tenantId ? getMyProjects(tenantId, user.id) : Promise.resolve([]),
    admin.from('users').select('id, name').order('name'),
    getCalendarEvents(monday.toISOString(), sunday.toISOString()),
    getProjectsForPlanning(),
    getContractedClientIds(),
  ]);

  const { projets, taches, interventions, clients } = legacyData;
  const usersPlain        = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));
  const clientsFullForModal = clients.map((c) => ({
    id:      c.id,
    nom:     c.nom     as string,
    adresse: (c as unknown as { adresse?: string }).adresse ?? null,
    ville:   (c as unknown as { ville?: string }).ville   ?? null,
    tel:     (c as unknown as { tel?: string }).tel     ?? null,
  }));

  // ── Vue principale : deux onglets ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Chef de Projet</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {userName} · {projets.length} dossier{projets.length !== 1 ? 's' : ''}
          {projectsR4.length > 0 && ` · ${projectsR4.length} projet${projectsR4.length !== 1 ? 's' : ''} assigné${projectsR4.length !== 1 ? 's' : ''}`}
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

      {/* Contenu onglet Tableau de bord */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <ChefDashboardV2 data={dashData} />

          {projectsR4.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">
                Mes projets assignés
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {projectsR4.length}
                </span>
              </h2>
              <ProjectList projects={projectsR4} users={usersPlain} />
            </div>
          )}

          {projets.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Mes dossiers</h2>
              <ProjetList projets={projets} clients={clients} />
            </div>
          )}

          {/* Ancien dashboard KPI (fallback alerts) */}
          {(taches.length > 0 || interventions.length > 0) && (
            <ChefDashboard
              projets={projets}
              taches={taches}
              interventions={interventions}
            />
          )}
        </div>
      )}

      {/* Contenu onglet Planning */}
      {activeTab === 'planning' && (
        <CalendarView
          initialEvents={initialEvents}
          clients={clientsFullForModal}
          techniciens={legacyData.techniciens}
          projects={projectsForPlanning}
          contractedClientIds={contractedIds}
        />
      )}
    </div>
  );
}
