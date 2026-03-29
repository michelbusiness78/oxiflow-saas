import { redirect } from 'next/navigation';
import { Suspense }  from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ClientList }  from '@/components/commerce/ClientList';
import { DevisList }   from '@/components/commerce/DevisList';
import { FactureList } from '@/components/commerce/FactureList';
import { ContratList } from '@/components/commerce/ContratList';
import type { Client }   from '@/components/commerce/ClientList';
import type { Devis }    from '@/components/commerce/DevisForm';
import type { Facture }  from '@/components/commerce/FactureForm';
import type { Contrat }  from '@/components/commerce/ContratForm';
import type { DevisLigne } from '@/app/actions/commerce';

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchCommerceData() {
  // Auth via client standard (cookies)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Lecture des données via admin pour bypasser RLS
  const admin = await createAdminClient();

  // Récupère le tenant_id de l'utilisateur
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const [clientsRes, devisRes, facturesRes, contratsRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, nom, contact, email, tel, adresse, cp, ville, notes, created_at')
      .eq('tenant_id', tenantId)
      .order('nom'),
    admin
      .from('devis')
      .select('id, num, client_id, date, validite, statut, lignes, montant_ht, tva, montant_ttc, clients(nom)')
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
  ]);

  const clients = (clientsRes.data ?? []) as Client[];

  const devis = (devisRes.data ?? []).map((d) => ({
    ...d,
    lignes:     (d.lignes as Devis['lignes']) ?? [],
    client_nom: (d.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const factures = (facturesRes.data ?? []).map((f) => ({
    ...f,
    lignes:     (f.lignes as Facture['lignes']) ?? [],
    client_nom: (f.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  const contrats = (contratsRes.data ?? []).map((c) => ({
    ...c,
    client_nom: (c.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  return { clients, devis, factures, contrats };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string; from_devis?: string }>;
}

export default async function CommercePage({ searchParams }: PageProps) {
  const { clients, devis, factures, contrats } = await fetchCommerceData();
  const params = await searchParams;
  const tab    = params?.tab ?? 'clients';

  // Pré-remplissage facture depuis un devis accepté
  const fromDevisId = params?.from_devis;
  const fromDevis = fromDevisId
    ? devis.find((d) => d.id === fromDevisId) ?? null
    : null;

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
    { key: 'clients',  label: 'Clients',  count: clients.length  },
    { key: 'devis',    label: 'Devis',    count: devis.length    },
    { key: 'factures', label: 'Factures', count: factures.length },
    { key: 'contrats', label: 'Contrats', count: contrats.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Commerce</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Clients, devis, factures et contrats
        </p>
      </div>

      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      <div className="space-y-4">
        {tab === 'clients' && <ClientList clients={clients} />}

        {tab === 'devis' && <DevisList devis={devis} clients={clients} />}

        {tab === 'factures' && (
          <FactureList
            factures={factures}
            clients={clients}
            fromDevis={fromDevisData}
          />
        )}

        {tab === 'contrats' && <ContratList contrats={contrats} clients={clients} />}
      </div>
    </div>
  );
}
