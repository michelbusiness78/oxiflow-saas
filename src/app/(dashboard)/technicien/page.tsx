import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { InterventionList }   from '@/components/technicien/InterventionList';
import { TechnicienContent }  from '@/components/technicien/TechnicienContent';
import { TechnicienKpis }     from '@/components/technicien/TechnicienKpis';
import {
  getInterventionNotifications,
  getMyInterventions,
  getTechnicienKpis,
} from '@/app/actions/technicien-notifications';
import type { Intervention } from '@/components/technicien/InterventionForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchTechnicienData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('name, tenant_id')
    .eq('id', user.id)
    .single();

  const profileName = profile?.name ?? user.email ?? 'Technicien';
  const tenantId    = profile?.tenant_id as string;

  const [interventionsRes, clientsRes, catalogueRes, notifications, planning, kpis] =
    await Promise.all([
      admin
        .from('interventions')
        .select(`
          id, client_id, projet_id, technicien_id, date, type, statut,
          duree_minutes, notes, adresse, photos, checklist, materiel, signature_url, created_at,
          clients(nom),
          users(name)
        `)
        .eq('technicien_id', user.id)
        .order('date', { ascending: false }),

      admin
        .from('clients')
        .select('id, nom, adresse, cp, ville, tel')
        .eq('tenant_id', tenantId)
        .order('nom'),

      admin
        .from('catalogue_produits')
        .select('id, ref, designation')
        .eq('tenant_id', tenantId)
        .order('designation'),

      getInterventionNotifications(tenantId, user.id),
      getMyInterventions(tenantId, user.id),
      getTechnicienKpis(tenantId, user.id),
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
    clients:     clientsRes.data ?? [],
    catalogue:   catalogueRes.data ?? [],
    currentUser: { id: user.id, name: profileName },
    notifications,
    planning,
    kpis,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TechnicienPage() {
  const {
    interventions,
    clients,
    catalogue,
    currentUser,
    notifications,
    planning,
    kpis,
  } = await fetchTechnicienData();

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Mon espace</h1>
        <p className="mt-0.5 text-sm text-slate-500">{currentUser.name}</p>
      </div>

      {/* B) KPIs — toujours visibles */}
      <TechnicienKpis kpis={kpis} />

      {/* A) Bandeau + C) Planning + panel détail — état géré côté client */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-700">Planning terrain</h2>
        <TechnicienContent
          initialNotifications={notifications}
          initialPlanning={planning}
        />
      </section>

      <hr className="border-[#dde3f0]" />

      {/* Rapports d'intervention (module technicien historique) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-700">Rapports d'intervention</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {interventions.length} rapport{interventions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <InterventionList
          interventions={interventions}
          clients={clients}
          catalogue={catalogue}
          currentUserId={currentUser.id}
        />
      </section>

    </div>
  );
}
