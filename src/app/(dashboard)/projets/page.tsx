import { redirect }  from 'next/navigation';
import { Suspense }   from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { DossierList }   from '@/components/projets/DossierList';
import { TacheList }     from '@/components/projets/TacheList';
import { SAVList }       from '@/components/projets/SAVList';
import { FicheClient }   from '@/components/projets/FicheClient';
import { ProjectList }   from '@/components/projets/ProjectList';
import { getProjects }   from '@/app/actions/projects';
import type { Dossier }    from '@/components/projets/DossierForm';
import type { Tache }      from '@/components/projets/TacheForm';
import type { SAVTicket }  from '@/components/projets/SAVForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProjetsData() {
  // Utilise createClient() uniquement pour l'auth, createAdminClient() pour les données
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  const tenantId = profile?.tenant_id as string | undefined;

  console.log('[FicheClient] tenant_id:', tenantId);

  const [projetsRes, tachesRes, savRes, clientsRes, contratsRes, quotesRes, invoicesRes, usersRes, projectsRes] =
    await Promise.all([
      // Ancienne table projets (dossiers legacy)
      tenantId
        ? admin.from('projets').select('id, client_id, nom, type_projet, statut, date_debut, date_fin_prevue, pct_avancement, montant_ht, devis_id, facture_id, chef_projet_id, created_at, clients(nom), users(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('projets').select('id, client_id, nom, type_projet, statut, date_debut, date_fin_prevue, pct_avancement, montant_ht, devis_id, facture_id, chef_projet_id, created_at, clients(nom), users(name)').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('taches').select('id, projet_id, titre, description, assigne_a, priorite, etat, date_echeance, pct_avancement, created_at, projets(nom), users(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('taches').select('id, projet_id, titre, description, assigne_a, priorite, etat, date_echeance, pct_avancement, created_at, projets(nom), users(name)').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('sav_tickets').select('id, client_id, titre, description, priorite, statut, contrat_id, assigne_a, date_ouverture, date_resolution, created_at, clients(nom), users(name)').eq('tenant_id', tenantId).order('date_ouverture', { ascending: false })
        : admin.from('sav_tickets').select('id, client_id, titre, description, priorite, statut, contrat_id, assigne_a, date_ouverture, date_resolution, created_at, clients(nom), users(name)').order('date_ouverture', { ascending: false }),

      tenantId
        ? admin.from('clients').select('id, nom, email, tel, adresse, cp, ville').eq('tenant_id', tenantId).order('nom')
        : admin.from('clients').select('id, nom, email, tel, adresse, cp, ville').order('nom'),

      tenantId
        ? admin.from('contrats').select('id, client_id, type, montant_mensuel, actif, date_debut, date_fin').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('contrats').select('id, client_id, type, montant_mensuel, actif, date_debut, date_fin').order('created_at', { ascending: false }),

      // Nouvelle table quotes (remplace devis)
      tenantId
        ? admin.from('quotes').select('id, number, client_id, statut, montant_ttc, date').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('quotes').select('id, number, client_id, statut, montant_ttc, date').order('created_at', { ascending: false }),

      // Nouvelle table invoices (remplace factures)
      tenantId
        ? admin.from('invoices').select('id, number, client_id, status, total_ttc, date_facture, date_echeance').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('invoices').select('id, number, client_id, status, total_ttc, date_facture, date_echeance').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('users').select('id, name').eq('tenant_id', tenantId).order('name')
        : admin.from('users').select('id, name').order('name'),

      // Nouvelle table projects (remplace projets pour la fiche client)
      tenantId
        ? admin.from('projects').select('id, client_id, name, status, amount_ttc, deadline').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('projects').select('id, client_id, name, status, amount_ttc, deadline').order('created_at', { ascending: false }),
    ]);

  console.log('[FicheClient] quotes count:', quotesRes.data?.length ?? 0, quotesRes.error?.message);
  console.log('[FicheClient] invoices count:', invoicesRes.data?.length ?? 0, invoicesRes.error?.message);
  console.log('[FicheClient] projects count:', projectsRes.data?.length ?? 0, projectsRes.error?.message);
  console.log('[FicheClient] clients count:', clientsRes.data?.length ?? 0);

  const clients  = clientsRes.data  ?? [];
  const contrats = contratsRes.data ?? [];
  const users    = (usersRes.data ?? []).map((u) => ({
    id:     u.id,
    nom:    u.name,
    prenom: '',
  }));

  // Mapper quotes → format attendu par FicheClient (ancien format "devis")
  const devis = (quotesRes.data ?? []).map((q) => ({
    id:          q.id,
    num:         q.number as string,
    client_id:   q.client_id as string,
    statut:      (q.statut as string) ?? 'brouillon',
    montant_ttc: (q.montant_ttc as number) ?? 0,
    date:        (q.date as string) ?? '',
  }));

  // Mapper invoices → format attendu par FicheClient (ancien format "factures")
  // Conversion statuts: emise→envoyee, en_retard→impayee
  const statusMap: Record<string, string> = {
    brouillon: 'brouillon',
    emise:     'envoyee',
    payee:     'payee',
    en_retard: 'impayee',
  };
  const factures = (invoicesRes.data ?? []).map((f) => ({
    id:          f.id,
    num:         f.number as string,
    client_id:   f.client_id as string,
    statut:      statusMap[(f.status as string) ?? 'brouillon'] ?? 'brouillon',
    montant_ttc: (f.total_ttc as number) ?? 0,
    date:        (f.date_facture as string) ?? '',
    echeance:    (f.date_echeance as string) ?? '',
  }));

  // Dossiers legacy depuis ancienne table projets
  const dossiers = (projetsRes.data ?? []).map((p) => ({
    ...p,
    type_projet:    p.type_projet    ?? null,
    montant_ht:     p.montant_ht     ?? null,
    facture_id:     p.facture_id     ?? null,
    chef_projet_id: p.chef_projet_id ?? null,
    client_nom: (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
    chef_nom:   (p.users   as unknown as { name: string } | null)?.name ?? '—',
  })) as (Dossier & { client_id: string; client_nom: string; chef_nom: string; devis_num?: string })[];

  // Fusionner projets (nouvelle table) dans les dossiers pour la fiche client
  const projectsAsDossiers = (projectsRes.data ?? []).map((p) => ({
    id:             p.id,
    client_id:      p.client_id as string,
    nom:            p.name as string,
    statut:         (p.status as string) ?? 'nouveau',
    pct_avancement: 0,
    montant_ht:     (p.amount_ttc as number) ?? null,
    date_fin_prevue: (p.deadline as string) ?? null,
    type_projet:    null,
    devis_id:       null,
    facture_id:     null,
    chef_projet_id: null,
    client_nom:     '—',
    chef_nom:       '—',
  })) as (Dossier & { client_id: string; client_nom: string; chef_nom: string })[];

  const allDossiers = [...dossiers, ...projectsAsDossiers];

  const taches = (tachesRes.data ?? []).map((t) => ({
    ...t,
    description: t.description ?? null,
    projet_nom:  (t.projets as unknown as { nom: string } | null)?.nom,
    assigne_nom: (t.users   as unknown as { name: string } | null)?.name,
  })) as (Tache & { client_id?: string; projet_nom?: string; assigne_nom?: string })[];

  const savTickets = (savRes.data ?? []).map((s) => ({
    ...s,
    titre:        s.titre      ?? null,
    assigne_a:    s.assigne_a  ?? null,
    contrat_id:   s.contrat_id ?? null,
    client_nom:   (s.clients as unknown as { nom: string } | null)?.nom ?? '—',
    assigne_nom:  (s.users   as unknown as { name: string } | null)?.name,
    sous_contrat: !!s.contrat_id,
  })) as (SAVTicket & { client_id: string; client_nom?: string; assigne_nom?: string; sous_contrat?: boolean })[];

  const devisForForm = (quotesRes.data ?? []).map((q) => ({
    id:        q.id,
    num:       q.number as string,
    client_id: q.client_id as string,
  }));

  // Projets R4 (pour l'onglet Projets)
  const projectsR4 = tenantId ? await getProjects(tenantId) : [];
  const usersPlain = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));

  return { dossiers: allDossiers, taches, savTickets, clients, contrats, devis, factures, users, devisForForm, projectsR4, usersPlain };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjetsPage({ searchParams }: PageProps) {
  const { dossiers, taches, savTickets, clients, contrats, devis, factures, users, devisForForm, projectsR4, usersPlain } =
    await fetchProjetsData();

  const params = await searchParams;
  const tab    = params?.tab ?? 'projets';

  const tabs: TabItem[] = [
    { key: 'projets',      label: 'Projets',     count: projectsR4.length  },
    { key: 'dossiers',     label: 'Dossiers',    count: dossiers.length    },
    { key: 'taches',       label: 'Tâches',       count: taches.length      },
    { key: 'sav',          label: 'SAV',          count: savTickets.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours').length },
    { key: 'fiche-client', label: 'Fiche Client'                             },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Projets & Dossiers</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Dossiers, tâches, SAV et fiches clients
        </p>
      </div>

      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'projets' && (
          <ProjectList projects={projectsR4} users={usersPlain} />
        )}

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
