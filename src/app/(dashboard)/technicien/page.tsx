import { redirect }   from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InterventionList } from '@/components/technicien/InterventionList';
import type { Intervention } from '@/components/technicien/InterventionForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTechnicienData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  const profileName = profile?.name ?? user.email ?? 'Technicien';

  const [interventionsRes, clientsRes, catalogueRes] = await Promise.all([
    supabase
      .from('interventions')
      .select(`
        id, client_id, projet_id, technicien_id, date, type, statut,
        duree_minutes, notes, adresse, photos, checklist, materiel, signature_url, created_at,
        clients(nom),
        users(name)
      `)
      .eq('technicien_id', user.id)
      .order('date', { ascending: false }),

    supabase
      .from('clients')
      .select('id, nom, adresse, cp, ville')
      .order('nom'),

    supabase
      .from('catalogue_produits')
      .select('id, ref, designation')
      .order('designation'),
  ]);

  const interventions = (interventionsRes.data ?? []).map((i) => ({
    ...i,
    notes:          i.notes         ?? null,
    adresse:        i.adresse       ?? null,
    signature_url:  i.signature_url ?? null,
    photos:         (i.photos    as string[])                    ?? [],
    checklist:      (i.checklist as Intervention['checklist'])   ?? [],
    materiel:       (i.materiel  as Intervention['materiel'])    ?? [],
    client_nom:     (i.clients as unknown as { nom: string } | null)?.nom ?? '—',
    technicien_nom: (i.users   as unknown as { name: string } | null)?.name ?? profileName,
  })) as Intervention[];

  return {
    interventions,
    clients:     clientsRes.data   ?? [],
    catalogue:   catalogueRes.data ?? [],
    currentUser: { id: user.id, name: profileName },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TechnicienPage() {
  const { interventions, clients, catalogue, currentUser } = await fetchTechnicienData();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Mes interventions</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          {currentUser.name} · {interventions.length} intervention{interventions.length !== 1 ? 's' : ''}
        </p>
      </div>

      <InterventionList
        interventions={interventions}
        clients={clients}
        catalogue={catalogue}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
