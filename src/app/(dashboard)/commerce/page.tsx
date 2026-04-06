import { redirect } from 'next/navigation';
import { Suspense }  from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Tabs, type TabItem }  from '@/components/ui/Tabs';
import { ClientList }          from '@/components/commerce/ClientList';
import { QuoteList }           from '@/components/commerce/QuoteList';
import { ContratList }         from '@/components/commerce/ContratList';
import { CatalogueList }       from '@/components/commerce/CatalogueList';
import { CommerceDashboard }   from '@/components/commerce/CommerceDashboard';
import { InvoiceList }         from '@/components/commerce/InvoiceList';
import { FicheClient }         from '@/components/commerce/FicheClient';
import { getDashboardCommerce } from '@/app/actions/commerce';
import { getInvoices }         from '@/app/actions/invoices';
import { getCompanies }        from '@/app/actions/companies';
import type { Client }         from '@/components/commerce/ClientList';
import type { Contrat }        from '@/components/commerce/ContratForm';
import type { CatalogueItem }  from '@/app/actions/catalogue';
import type { QuoteWithClient, TenantUser } from '@/components/commerce/QuoteForm';

// ─── Fetch (onglets non-dashboard) ───────────────────────────────────────────

async function fetchCommerceData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, name')
    .eq('id', user.id)
    .single();

  const tenantId        = profile?.tenant_id as string;
  const currentUserName = (profile?.name as string) ?? user.email ?? 'Utilisateur';

  const [clientsRes, quotesRes, contratsRes, catalogueRes, usersRes, companiesData, invoicesData, savRes, projectsRes] =
    await Promise.all([
      admin
        .from('clients')
        .select('id, nom, contact, email, tel, adresse, cp, ville, siret, tva_intra, conditions_paiement, notes, actif, created_at')
        .eq('tenant_id', tenantId)
        .order('nom'),
      admin
        .from('quotes')
        .select('id, number, affair_number, client_id, company_id, commercial_user_id, chef_projet_user_id, objet, date, validity, statut, lignes, notes, conditions, deposit_percent, project_created, project_id, montant_ht, tva_amount, montant_ttc, created_at, clients(nom)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      admin
        .from('contrats')
        .select('id, client_id, type, date_debut, date_fin, montant_mensuel, actif, created_at, clients(nom)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      admin
        .from('catalogue')
        .select('id, ref, designation, description, fournisseur, categorie, type, prix_achat, prix_vente, tva, unite, actif, imported_from, created_at')
        .eq('tenant_id', tenantId)
        .order('designation'),
      admin
        .from('users')
        .select('id, name, role')
        .eq('tenant_id', tenantId)
        .order('name'),
      getCompanies(tenantId),
      getInvoices(tenantId),
      admin
        .from('sav_tickets')
        .select('id, client_id, titre, priorite, statut, date_ouverture')
        .eq('tenant_id', tenantId)
        .order('date_ouverture', { ascending: false }),
      admin
        .from('projects')
        .select('id, client_id, nom, statut, pct_avancement, montant_ht, date_fin_prevue')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    ]);

  const clients = (clientsRes.data ?? []) as Client[];

  const quotes = (quotesRes.data ?? []).map((q) => ({
    ...q,
    lignes:          (q.lignes as QuoteWithClient['lignes']) ?? [],
    client_nom:      (q.clients as unknown as { nom: string } | null)?.nom ?? '—',
    deposit_percent: (q.deposit_percent as number) ?? 0,
  })) as QuoteWithClient[];

  const contrats = (contratsRes.data ?? []).map((c) => ({
    ...c,
    client_nom: (c.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const catalogue  = (catalogueRes.data ?? []) as CatalogueItem[];

  const users    = (usersRes.data ?? []) as TenantUser[];
  const companies = companiesData;
  const invoices  = invoicesData;

  const savs = (savRes.data ?? []) as {
    id: string; client_id: string; titre: string | null;
    priorite: string; statut: string; date_ouverture: string;
  }[];

  const dossiers = (projectsRes.data ?? []) as {
    id: string; client_id: string; nom: string; statut: string;
    pct_avancement: number; montant_ht: number | null; date_fin_prevue: string | null;
  }[];

  return {
    tenantId, clients, quotes, invoices, contrats, catalogue,
    users, currentUserId: user.id, currentUserName, companies,
    savs, dossiers,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string; from_devis?: string }>;
}

export default async function CommercePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab    = params?.tab ?? 'dashboard';

  // ── Tableau de bord (onglet par défaut) ─────────────────────────────────────
  if (tab === 'dashboard') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const admin = await createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('tenant_id, name')
      .eq('id', user.id)
      .single();

    const tenantId   = profile?.tenant_id as string;
    const userName   = (profile?.name as string) ?? user.email ?? 'Utilisateur';
    const dashData   = await getDashboardCommerce(tenantId);

    const tabs: TabItem[] = [
      { key: 'dashboard',     label: 'Tableau de bord'                            },
      { key: 'clients',       label: 'Clients'                                     },
      { key: 'fiche-client',  label: 'Fiche Client'                                },
      { key: 'catalogue',     label: 'Catalogue'                                   },
      { key: 'devis',         label: 'Devis',     count: dashData.kpis.totalDevis  },
      { key: 'factures',      label: 'Factures'                                    },
      { key: 'contrats',      label: 'Contrats'                                    },
    ];

    return (
      <div className="space-y-6">
        <Suspense>
          <Tabs tabs={tabs} current={tab} />
        </Suspense>
        <CommerceDashboard data={dashData} userName={userName} />
      </div>
    );
  }

  // ── Autres onglets ──────────────────────────────────────────────────────────
  const { clients, quotes, invoices, contrats, catalogue, users, currentUserId, currentUserName, companies, savs, dossiers } =
    await fetchCommerceData();

  const tabs: TabItem[] = [
    { key: 'dashboard',     label: 'Tableau de bord'                              },
    { key: 'clients',       label: 'Clients',      count: clients.length          },
    { key: 'fiche-client',  label: 'Fiche Client'                                 },
    { key: 'catalogue',     label: 'Catalogue',    count: catalogue.length        },
    { key: 'devis',         label: 'Devis',        count: quotes.length           },
    { key: 'factures',      label: 'Factures',     count: invoices.length         },
    { key: 'contrats',      label: 'Contrats',     count: contrats.length         },
  ];

  return (
    <div className="space-y-6">
      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'clients'      && <ClientList clients={clients} />}

        {tab === 'fiche-client' && (
          <FicheClient
            clients={clients}
            dossiers={dossiers}
            devis={quotes.filter((q) => q.client_id).map((q) => ({
              id:          q.id,
              client_id:   q.client_id as string,
              num:         q.number,
              statut:      q.statut,
              montant_ttc: q.montant_ttc,
              date:        q.date,
            }))}
            factures={invoices.map((f) => ({
              id:          f.id,
              client_id:   f.client_id,
              num:         f.number,
              statut:      f.status,
              montant_ttc: f.total_ttc,
              date:        f.date_facture,
              echeance:    f.date_echeance,
            }))}
            contrats={contrats.map((c) => ({
              id:              c.id,
              client_id:       c.client_id,
              type:            c.type,
              montant_mensuel: c.montant_mensuel,
              actif:           c.actif,
              date_debut:      c.date_debut,
              date_fin:        c.date_fin,
            }))}
            savs={savs}
          />
        )}

        {tab === 'devis'     && (
          <QuoteList
            quotes={quotes}
            clients={clients}
            catalogue={catalogue}
            users={users}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            companies={companies}
            invoices={invoices}
          />
        )}

        {tab === 'factures'  && (
          <InvoiceList
            invoices={invoices}
            clients={clients}
            catalogue={catalogue}
            companies={companies}
          />
        )}

        {tab === 'contrats'  && <ContratList contrats={contrats} clients={clients} />}

        {tab === 'catalogue' && <CatalogueList catalogue={catalogue} />}
      </div>
    </div>
  );
}
