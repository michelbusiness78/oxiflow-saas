import { redirect } from 'next/navigation';
import { Suspense }  from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ClientList }    from '@/components/commerce/ClientList';
import { QuoteList }     from '@/components/commerce/QuoteList';
import { FactureList }   from '@/components/commerce/FactureList';
import { ContratList }   from '@/components/commerce/ContratList';
import { CatalogueList } from '@/components/commerce/CatalogueList';
import type { Client }         from '@/components/commerce/ClientList';
import type { Facture }        from '@/components/commerce/FactureForm';
import type { Contrat }        from '@/components/commerce/ContratForm';
import type { DevisLigne }     from '@/app/actions/commerce';
import type { CatalogueItem }  from '@/app/actions/catalogue';
import type { QuoteWithClient, TenantUser } from '@/components/commerce/QuoteForm';

// ─── Fetch ────────────────────────────────────────────────────────────────────

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

  const tenantId = profile?.tenant_id as string;
  const currentUserName = (profile?.name as string) ?? user.email ?? 'Utilisateur';

  const [clientsRes, quotesRes, facturesRes, contratsRes, catalogueRes, devisRes, usersRes, tenantRes] =
    await Promise.all([
      admin
        .from('clients')
        .select('id, nom, contact, email, tel, adresse, cp, ville, siret, tva_intra, conditions_paiement, notes, actif, created_at')
        .eq('tenant_id', tenantId)
        .order('nom'),
      admin
        .from('quotes')
        .select('id, number, affair_number, client_id, commercial_user_id, chef_projet_user_id, objet, date, validity, statut, lignes, notes, conditions, deposit_percent, montant_ht, tva_amount, montant_ttc, created_at, clients(nom)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      admin
        .from('factures')
        .select('id, num, client_id, devis_id, date, echeance, statut, lignes, montant_ht, tva, montant_ttc, clients(nom)')
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
      // Old devis for FactureList from_devis
      admin
        .from('devis')
        .select('id, num, client_id, date, validite, statut, lignes, montant_ht, tva, montant_ttc, clients(nom)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      // Users du tenant (pour chef de projet selector)
      admin
        .from('users')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name'),
      // Nom de la société
      admin
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single(),
    ]);

  const clients = (clientsRes.data ?? []) as Client[];

  const quotes = (quotesRes.data ?? []).map((q) => ({
    ...q,
    lignes:      (q.lignes as QuoteWithClient['lignes']) ?? [],
    client_nom:  (q.clients as unknown as { nom: string } | null)?.nom ?? '—',
    deposit_percent: (q.deposit_percent as number) ?? 0,
  })) as QuoteWithClient[];

  const factures = (facturesRes.data ?? []).map((f) => ({
    ...f,
    lignes:     (f.lignes as Facture['lignes']) ?? [],
    client_nom: (f.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const contrats = (contratsRes.data ?? []).map((c) => ({
    ...c,
    client_nom: (c.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const catalogue = (catalogueRes.data ?? []) as CatalogueItem[];

  const devis = (devisRes.data ?? []).map((d) => ({
    ...d,
    lignes:     (d.lignes as import('@/app/actions/commerce').DevisLigne[]) ?? [],
    client_nom: (d.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const users = (usersRes.data ?? []) as TenantUser[];
  const tenantName = (tenantRes.data?.name as string) ?? '';

  return {
    clients, quotes, factures, contrats, catalogue, devis,
    users, currentUserId: user.id, currentUserName, tenantName,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string; from_devis?: string }>;
}

export default async function CommercePage({ searchParams }: PageProps) {
  const {
    clients, quotes, factures, contrats, catalogue, devis,
    users, currentUserId, currentUserName, tenantName,
  } = await fetchCommerceData();

  const params = await searchParams;
  const tab    = params?.tab ?? 'clients';

  const fromDevisId = params?.from_devis;
  const fromDevis   = fromDevisId ? devis.find((d) => d.id === fromDevisId) ?? null : null;

  const fromDevisData = fromDevis
    ? {
        id:          fromDevis.id,
        client_id:   fromDevis.client_id,
        lignes:      fromDevis.lignes as DevisLigne[],
        montant_ht:  fromDevis.montant_ht,
        tva:         fromDevis.tva,
        montant_ttc: fromDevis.montant_ttc,
      }
    : null;

  const tabs: TabItem[] = [
    { key: 'clients',   label: 'Clients',   count: clients.length   },
    { key: 'catalogue', label: 'Catalogue', count: catalogue.length },
    { key: 'devis',     label: 'Devis',     count: quotes.length    },
    { key: 'factures',  label: 'Factures',  count: factures.length  },
    { key: 'contrats',  label: 'Contrats',  count: contrats.length  },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Commerce</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Clients, devis, factures, contrats et catalogue
        </p>
      </div>

      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'clients'   && <ClientList clients={clients} />}

        {tab === 'devis'     && (
          <QuoteList
            quotes={quotes}
            clients={clients}
            catalogue={catalogue}
            users={users}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            tenantName={tenantName}
          />
        )}

        {tab === 'factures'  && (
          <FactureList
            factures={factures}
            clients={clients}
            fromDevis={fromDevisData}
          />
        )}

        {tab === 'contrats'  && <ContratList contrats={contrats} clients={clients} />}

        {tab === 'catalogue' && <CatalogueList catalogue={catalogue} />}
      </div>
    </div>
  );
}
