import { redirect }  from 'next/navigation';
import { Suspense }   from 'react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { DossierList } from '@/components/projets/DossierList';
import { TacheList }   from '@/components/projets/TacheList';
import { SAVList }     from '@/components/projets/SAVList';
import { FicheClient } from '@/components/projets/FicheClient';
import type { Dossier } from '@/components/projets/DossierForm';
import type { Tache }   from '@/components/projets/TacheForm';
import type { SAVTicket } from '@/components/projets/SAVForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProjetsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [projetsRes, tachesRes, savRes, clientsRes, contratsRes, devisRes, facturesRes, usersRes] =
    await Promise.all([
      supabase
        .from('projets')
        .select('id, client_id, nom, type_projet, statut, date_debut, date_fin_prevue, pct_avancement, montant_ht, devis_id, facture_id, chef_projet_id, created_at, clients(nom), users(nom, prenom)')
        .order('created_at', { ascending: false }),

      supabase
        .from('taches')
        .select('id, projet_id, titre, description, assigne_a, priorite, etat, date_echeance, pct_avancement, created_at, projets(nom), users(nom, prenom)')
        .order('created_at', { ascending: false }),

      supabase
        .from('sav_tickets')
        .select('id, client_id, titre, description, priorite, statut, contrat_id, assigne_a, date_ouverture, date_resolution, created_at, clients(nom), users(nom, prenom)')
        .order('date_ouverture', { ascending: false }),

      supabase
        .from('clients')
        .select('id, nom, email, tel, adresse, cp, ville')
        .order('nom'),

      supabase
        .from('contrats')
        .select('id, client_id, type, montant_mensuel, actif, date_debut, date_fin')
        .order('created_at', { ascending: false }),

      supabase
        .from('devis')
        .select('id, num, client_id, statut, montant_ttc, date')
        .order('created_at', { ascending: false }),

      supabase
        .from('factures')
        .select('id, num, client_id, statut, montant_ttc, date, echeance')
        .order('created_at', { ascending: false }),

      supabase
        .from('users')
        .select('id, nom, prenom')
        .order('nom'),
    ]);

  const clients  = clientsRes.data  ?? [];
  const contrats = contratsRes.data ?? [];
  const devis    = devisRes.data    ?? [];
  const factures = facturesRes.data ?? [];
  const users    = usersRes.data    ?? [];

  const dossiers = (projetsRes.data ?? []).map((p) => ({
    ...p,
    type_projet:    p.type_projet    ?? null,
    montant_ht:     p.montant_ht     ?? null,
    facture_id:     p.facture_id     ?? null,
    chef_projet_id: p.chef_projet_id ?? null,
    client_nom: (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
    chef_nom:   (() => {
      const u = p.users as unknown as { nom: string; prenom: string } | null;
      return u ? `${u.prenom} ${u.nom}` : '—';
    })(),
  })) as (Dossier & { client_id: string; client_nom: string; chef_nom: string; devis_num?: string })[];

  const taches = (tachesRes.data ?? []).map((t) => ({
    ...t,
    description: t.description ?? null,
    projet_nom:  (t.projets as unknown as { nom: string } | null)?.nom,
    assigne_nom: (() => {
      const u = t.users as unknown as { nom: string; prenom: string } | null;
      return u ? `${u.prenom} ${u.nom}` : undefined;
    })(),
  })) as (Tache & { client_id?: string; projet_nom?: string; assigne_nom?: string })[];

  const savTickets = (savRes.data ?? []).map((s) => ({
    ...s,
    titre:        s.titre      ?? null,
    assigne_a:    s.assigne_a  ?? null,
    contrat_id:   s.contrat_id ?? null,
    client_nom:   (s.clients as unknown as { nom: string } | null)?.nom ?? '—',
    assigne_nom:  (() => {
      const u = s.users as unknown as { nom: string; prenom: string } | null;
      return u ? `${u.prenom} ${u.nom}` : undefined;
    })(),
    sous_contrat: !!s.contrat_id,
  })) as (SAVTicket & { client_id: string; client_nom?: string; assigne_nom?: string; sous_contrat?: boolean })[];

  // Liste des devis pour le formulaire dossier (id + num + client_id)
  const devisForForm = devis.map((d) => ({ id: d.id, num: d.num, client_id: d.client_id }));

  return { dossiers, taches, savTickets, clients, contrats, devis, factures, users, devisForForm };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjetsPage({ searchParams }: PageProps) {
  const { dossiers, taches, savTickets, clients, contrats, devis, factures, users, devisForForm } =
    await fetchProjetsData();

  const params = await searchParams;
  const tab    = params?.tab ?? 'dossiers';

  const tabs: TabItem[] = [
    { key: 'dossiers',      label: 'Dossiers',     count: dossiers.length    },
    { key: 'taches',        label: 'Tâches',        count: taches.length      },
    { key: 'sav',           label: 'SAV',           count: savTickets.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours').length },
    { key: 'fiche-client',  label: 'Fiche Client'                              },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Projets & Dossiers</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Dossiers, tâches, SAV et fiches clients
        </p>
      </div>

      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'dossiers' && (
          <DossierList
            dossiers={dossiers}
            clients={clients}
            devisList={devisForForm}
            users={users}
          />
        )}

        {tab === 'taches' && (
          <TacheList
            taches={taches}
            dossiers={dossiers.map((d) => ({ id: d.id, nom: d.nom }))}
            users={users}
          />
        )}

        {tab === 'sav' && (
          <SAVList
            tickets={savTickets}
            clients={clients}
            contrats={contrats}
            users={users}
          />
        )}

        {tab === 'fiche-client' && (
          <FicheClient
            clients={clients}
            dossiers={dossiers}
            devis={devis}
            factures={factures}
            contrats={contrats}
            savs={savTickets}
          />
        )}
      </div>
    </div>
  );
}
