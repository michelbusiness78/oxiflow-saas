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
    .select('tenant_id, nom, prenom')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const [interventionsRes, clientsRes, catalogueRes] = await Promise.all([
    supabase
      .from('interventions')
      .select(`
        id, client_id, projet_id, technicien_id, date, type, statut,
        duree_minutes, notes, adresse, photos, checklist, materiel, signature_url, created_at,
        clients(nom),
        users(nom, prenom)
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
    notes:         i.notes         ?? null,
    adresse:       i.adresse       ?? null,
    signature_url: i.signature_url ?? null,
    photos:        (i.photos as string[]) ?? [],
    checklist:     (i.checklist   as Intervention['checklist'])  ?? [],
    materiel:      (i.materiel    as Intervention['materiel'])   ?? [],
    client_nom:     (i.clients as unknown as { nom: string } | null)?.nom ?? '—',
    technicien_nom: (() => {
      const u = i.users as unknown as { nom: string; prenom: string } | null;
      return u ? `${u.prenom} ${u.nom}` : `${profile.prenom} ${profile.nom}`;
    })(),
  })) as Intervention[];

  return {
    interventions,
    clients:   clientsRes.data   ?? [],
    catalogue: catalogueRes.data ?? [],
    currentUser: { id: user.id, nom: profile.nom, prenom: profile.prenom },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TechnicienPage() {
  const { interventions, clients, catalogue, currentUser } = await fetchTechnicienData();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Mes interventions</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          {currentUser.prenom} {currentUser.nom} · {interventions.length} intervention{interventions.length !== 1 ? 's' : ''}
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
