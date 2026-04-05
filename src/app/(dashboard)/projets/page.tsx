import { redirect }  from 'next/navigation';
import { Suspense }   from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { SAVList }       from '@/components/projets/SAVList';
import { FicheClient }   from '@/components/projets/FicheClient';
import { ProjectList }   from '@/components/projets/ProjectList';
import { getProjects }   from '@/app/actions/projects';
import type { SAVTicket }  from '@/components/projets/SAVForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchProjetsData() {
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

  const [savRes, clientsRes, contratsRes, quotesRes, invoicesRes, usersRes, projectsRes] =
    await Promise.all([
      tenantId
        ? admin.from('sav_tickets').select('id, client_id, titre, description, priorite, statut, contrat_id, assigne_a, date_ouverture, date_resolution, created_at, clients(nom), users(name)').eq('tenant_id', tenantId).order('date_ouverture', { ascending: false })
        : admin.from('sav_tickets').select('id, client_id, titre, description, priorite, statut, contrat_id, assigne_a, date_ouverture, date_resolution, created_at, clients(nom), users(name)').order('date_ouverture', { ascending: false }),

      tenantId
        ? admin.from('clients').select('id, nom, email, tel, adresse, cp, ville').eq('tenant_id', tenantId).order('nom')
        : admin.from('clients').select('id, nom, email, tel, adresse, cp, ville').order('nom'),

      tenantId
        ? admin.from('contrats').select('id, client_id, type, montant_mensuel, actif, date_debut, date_fin').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('contrats').select('id, client_id, type, montant_mensuel, actif, date_debut, date_fin').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('quotes').select('id, number, client_id, statut, montant_ttc, date').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('quotes').select('id, number, client_id, statut, montant_ttc, date').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('invoices').select('id, number, client_id, status, total_ttc, date_facture, date_echeance').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('invoices').select('id, number, client_id, status, total_ttc, date_facture, date_echeance').order('created_at', { ascending: false }),

      tenantId
        ? admin.from('users').select('id, name').eq('tenant_id', tenantId).order('name')
        : admin.from('users').select('id, name').order('name'),

      tenantId
        ? admin.from('projects').select('id, client_id, name, status, amount_ttc, deadline').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        : admin.from('projects').select('id, client_id, name, status, amount_ttc, deadline').order('created_at', { ascending: false }),
    ]);

  const clients  = clientsRes.data  ?? [];
  const contrats = contratsRes.data ?? [];
  const usersPlain = (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.name as string }));
  const users = (usersRes.data ?? []).map((u) => ({ id: u.id, nom: u.name as string, prenom: '' }));

  // Mapper quotes → format FicheClient
  const devis = (quotesRes.data ?? []).map((q) => ({
    id:          q.id,
    num:         q.number as string,
    client_id:   q.client_id as string,
    statut:      (q.statut as string) ?? 'brouillon',
    montant_ttc: (q.montant_ttc as number) ?? 0,
    date:        (q.date as string) ?? '',
  }));

  // Mapper invoices → format FicheClient
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

  // Mapper projects → format FicheClient (dossiers)
  type DossierMinimal = {
    id: string; client_id: string; nom: string; statut: string;
    pct_avancement: number; montant_ht: number | null;
    date_fin_prevue: string | null; type_projet: null;
    devis_id: null; facture_id: null; chef_projet_id: null;
    client_nom: string; chef_nom: string; created_at: string;
  };
  const dossiers: DossierMinimal[] = (projectsRes.data ?? []).map((p) => ({
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
    created_at:     '',
  }));

  const savTickets = (savRes.data ?? []).map((s) => ({
    ...s,
    titre:        s.titre      ?? null,
    assigne_a:    s.assigne_a  ?? null,
    contrat_id:   s.contrat_id ?? null,
    client_nom:   (s.clients as unknown as { nom: string } | null)?.nom ?? '—',
    assigne_nom:  (s.users   as unknown as { name: string } | null)?.name,
    sous_contrat: !!s.contrat_id,
  })) as (SAVTicket & { client_id: string; client_nom?: string; assigne_nom?: string; sous_contrat?: boolean })[];

  // Projets R4 pour l'onglet Projets
  const projectsR4 = tenantId ? await getProjects(tenantId) : [];

  return { projectsR4, savTickets, clients, contrats, devis, factures, dossiers, usersPlain, users };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjetsPage({ searchParams }: PageProps) {
  const { projectsR4, savTickets, clients, contrats, devis, factures, dossiers, usersPlain, users } =
    await fetchProjetsData();

  const params = await searchParams;
  const tab    = params?.tab ?? 'projets';

  const tabs: TabItem[] = [
    { key: 'projets',      label: 'Projets',     count: projectsR4.length  },
    { key: 'sav',          label: 'SAV',          count: savTickets.filter((t) => t.statut === 'ouvert' || t.statut === 'en_cours').length },
    { key: 'fiche-client', label: 'Fiche Client'                             },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Projets</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Suivi projets, SAV et fiches clients
        </p>
      </div>

      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'projets' && (
          <ProjectList projects={projectsR4} users={usersPlain} />
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
