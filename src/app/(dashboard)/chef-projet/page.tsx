import { redirect }    from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChefDashboard } from '@/components/chef-projet/ChefDashboard';
import { ProjetList }    from '@/components/chef-projet/ProjetList';
import { ProjetDetail }  from '@/components/chef-projet/ProjetDetail';
import type { Tache }    from '@/components/projets/TacheForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchData(userId: string) {
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

      supabase
        .from('clients')
        .select('id, nom')
        .order('nom'),

      // Techniciens uniquement pour le dropdown "Assigner"
      supabase
        .from('users')
        .select('id, name')
        .eq('role', 'technicien')
        .order('name'),

      // Tous les users pour le formulaire TacheList
      supabase
        .from('users')
        .select('id, name')
        .order('name'),
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
      description:    t.description   ?? null,
      assigne_a:      t.assigne_a     ?? null,
      date_echeance:  t.date_echeance ?? null,
      projet_nom:     (t.projets as unknown as { nom: string } | null)?.nom,
      assigne_nom:    (t.users   as unknown as { name: string } | null)?.name,
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

  const clients     = clientsRes.data     ?? [];
  const techniciens = (techniciensRes.data ?? []).map((u) => ({ id: u.id, name: u.name }));
  const allUsers    = (allUsersRes.data    ?? []).map((u) => ({ id: u.id, nom: u.name, prenom: '' }));

  return { projets, taches, interventions, clients, techniciens, allUsers };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ projet?: string }>;
}

export default async function ChefProjetPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profileRes = await supabase.from('users').select('name').eq('id', user.id).single();
  const userName   = profileRes.data?.name ?? user.email ?? 'Chef de projet';

  const { projets, taches, interventions, clients, techniciens, allUsers } =
    await fetchData(user.id);

  const params   = await searchParams;
  const projetId = params?.projet;

  // ── Vue détail ──────────────────────────────────────────────────────────────
  if (projetId) {
    const projet = projets.find((p) => p.id === projetId);
    if (!projet) redirect('/chef-projet');

    const projetTaches       = taches.filter((t) => t.projet_id === projetId);
    const projetInterventions = interventions.filter((i) => i.projet_id === projetId);

    return (
      <ProjetDetail
        projet={projet}
        taches={projetTaches}
        interventions={projetInterventions}
        users={allUsers}
        techniciens={techniciens}
      />
    );
  }

  // ── Vue liste ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Titre */}
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Chef de Projet</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          {userName} · {projets.length} projet{projets.length !== 1 ? 's' : ''} assigné{projets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tableau de bord */}
      <ChefDashboard
        projets={projets}
        taches={taches}
        interventions={interventions}
      />

      {/* Liste des projets */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-oxi-text">Mes projets</h2>
        <ProjetList projets={projets} clients={clients} />
      </div>
    </div>
  );
}
