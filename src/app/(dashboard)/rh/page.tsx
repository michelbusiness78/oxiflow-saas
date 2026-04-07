import { redirect }    from 'next/navigation';
import { Suspense }    from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { RhTabs }      from '@/components/rh/RhTabs';
import { MesTaches }   from '@/components/shared/MesTaches';
import { getPersonalTasks } from '@/app/actions/tasks';
import { CongeList,   type Conge }      from '@/components/rh/CongeList';
import { NoteFraisList, type NoteFrais } from '@/components/rh/NoteFraisList';
import { Soldes, type SoldeUser, type Mouvement } from '@/components/rh/Soldes';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchRhData(userId: string, isManager: boolean) {
  const supabase = await createClient();

  // Base queries — manager voit tout, employé voit ses propres données
  const congesQuery = supabase
    .from('conges')
    .select('id, user_id, type, date_debut, date_fin, nb_jours, commentaire, statut, created_at, users(name)')
    .order('created_at', { ascending: false });

  const notesQuery = supabase
    .from('notes_frais')
    .select('id, user_id, date, montant, categorie, description, justificatif_url, statut, created_at, users(name)')
    .order('created_at', { ascending: false });

  if (!isManager) {
    congesQuery.eq('user_id', userId);
    notesQuery.eq('user_id', userId);
  }

  const [congesRes, notesRes, usersRes, soldesRes, mouvRes] = await Promise.all([
    congesQuery,
    notesQuery,

    // Tous les utilisateurs pour les soldes
    supabase.from('users').select('id, name').order('name'),

    supabase.from('soldes_conges').select('user_id, type, solde'),

    supabase
      .from('mouvements_soldes')
      .select('id, user_id, type, delta, motif, created_at, users(name)')
      .order('created_at', { ascending: false })
      .limit(isManager ? 100 : 30)
      .then(async (res) => {
        if (!isManager) {
          return supabase
            .from('mouvements_soldes')
            .select('id, user_id, type, delta, motif, created_at, users(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30);
        }
        return res;
      }),
  ]);

  const conges: Conge[] = (congesRes.data ?? []).map((c) => ({
    id:          c.id,
    user_id:     c.user_id,
    user_nom:    (c.users as unknown as { name: string } | null)?.name ?? '—',
    type:        c.type as Conge['type'],
    date_debut:  c.date_debut,
    date_fin:    c.date_fin,
    nb_jours:    c.nb_jours,
    commentaire: c.commentaire ?? null,
    statut:      c.statut as Conge['statut'],
    created_at:  c.created_at,
  }));

  const notes: NoteFrais[] = (notesRes.data ?? []).map((n) => ({
    id:               n.id,
    user_id:          n.user_id,
    user_nom:         (n.users as unknown as { name: string } | null)?.name ?? '—',
    date:             n.date,
    montant:          Number(n.montant),
    categorie:        n.categorie as NoteFrais['categorie'],
    description:      n.description ?? null,
    justificatif_url: n.justificatif_url ?? null,
    statut:           n.statut as NoteFrais['statut'],
    created_at:       n.created_at,
  }));

  // Construction du tableau de soldes par user
  const allUsers  = usersRes.data  ?? [];
  const rawSoldes = soldesRes.data ?? [];

  const soldes: SoldeUser[] = allUsers.map((u) => ({
    user_id:  u.id,
    user_nom: u.name,
    cp:       Number(rawSoldes.find((s) => s.user_id === u.id && s.type === 'cp')?.solde  ?? 0),
    rtt:      Number(rawSoldes.find((s) => s.user_id === u.id && s.type === 'rtt')?.solde ?? 0),
  }));

  const mouvData = (await mouvRes).data ?? [];
  const mouvements: Mouvement[] = mouvData.map((m) => ({
    id:         m.id,
    user_id:    m.user_id,
    user_nom:   (m.users as unknown as { name: string } | null)?.name ?? '—',
    type:       m.type as 'cp' | 'rtt',
    delta:      Number(m.delta),
    motif:      m.motif,
    created_at: m.created_at,
  }));

  return { conges, notes, soldes, mouvements };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function RhPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('name, role, tenant_id')
    .eq('id', user.id)
    .single();

  const userName  = profile?.name  ?? user.email ?? 'Utilisateur';
  const role      = (profile?.role  as string) ?? 'commercial';
  const tenantId  = profile?.tenant_id as string;
  const isManager = role === 'dirigeant' || role === 'rh';

  const [rhData, personalTasks] = await Promise.all([
    fetchRhData(user.id, isManager),
    tenantId ? getPersonalTasks(tenantId, user.id) : Promise.resolve([]),
  ]);
  const { conges, notes, soldes, mouvements } = rhData;

  const params = await searchParams;
  const tab    = params?.tab ?? 'conges';

  const congesEnAttente = conges.filter((c) => c.statut === 'en_attente').length;
  const notesEnAttente  = notes.filter((n) => n.statut  === 'soumise').length;

  const pendingTaskCount = personalTasks.filter((t) => !t.done).length;
  const tabs = [
    { key: 'conges',      label: 'Congés',         count: congesEnAttente || undefined },
    { key: 'notes-frais', label: 'Notes de frais',  count: notesEnAttente  || undefined },
    { key: 'soldes',      label: 'Soldes'                                               },
    { key: 'taches',      label: '📌 Mes tâches',   count: pendingTaskCount || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Ressources Humaines</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {userName}
          {isManager ? ' · Vue dirigeant — toutes les demandes' : ' · Vos demandes'}
        </p>
      </div>

      {/* Onglets violet */}
      <Suspense>
        <RhTabs tabs={tabs} current={tab} />
      </Suspense>

      {/* Contenu */}
      <div className="space-y-4">
        {tab === 'conges' && (
          <CongeList
            conges={conges}
            isManager={isManager}
            userId={user.id}
          />
        )}

        {tab === 'notes-frais' && (
          <NoteFraisList
            notes={notes}
            isManager={isManager}
            userId={user.id}
          />
        )}

        {tab === 'soldes' && (
          <Soldes
            soldes={isManager ? soldes : soldes.filter((s) => s.user_id === user.id)}
            mouvements={mouvements}
            isManager={isManager}
            userId={user.id}
          />
        )}

        {tab === 'taches' && tenantId && (
          <MesTaches
            initialTasks={personalTasks}
            tenantId={tenantId}
            userId={user.id}
          />
        )}
      </div>
    </div>
  );
}
