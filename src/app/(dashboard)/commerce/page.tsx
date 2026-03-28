import { redirect } from 'next/navigation';
import { Suspense }  from 'react';
import { createClient } from '@/lib/supabase/server';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ClientList }  from '@/components/commerce/ClientList';
import { DevisList }   from '@/components/commerce/DevisList';
import type { Client } from '@/components/commerce/ClientList';
import type { Devis }  from '@/components/commerce/DevisForm';

// ─── Fetch data ───────────────────────────────────────────────────────────────

async function fetchCommerceData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [clientsRes, devisRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, nom, contact, email, tel, adresse, cp, ville, notes, created_at')
      .order('nom'),
    supabase
      .from('devis')
      .select('id, num, client_id, date, validite, statut, lignes, montant_ht, tva, montant_ttc, clients(nom)')
      .order('created_at', { ascending: false }),
  ]);

  const clients = (clientsRes.data ?? []) as Client[];

  // Enrichit chaque devis avec le nom du client
  const devis = (devisRes.data ?? []).map((d) => ({
    ...d,
    lignes:     (d.lignes as Devis['lignes']) ?? [],
    client_nom: (d.clients as unknown as { nom: string } | null)?.nom ?? '—',
  }));

  return { clients, devis };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function CommercePage({ searchParams }: PageProps) {
  const { clients, devis } = await fetchCommerceData();
  const params = await searchParams;
  const tab    = params?.tab ?? 'clients';

  const tabs: TabItem[] = [
    { key: 'clients',  label: 'Clients',  count: clients.length  },
    { key: 'devis',    label: 'Devis',    count: devis.length    },
    { key: 'factures', label: 'Factures'                         },
    { key: 'contrats', label: 'Contrats'                         },
  ];

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Commerce</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Clients, devis, factures et contrats
        </p>
      </div>

      {/* Onglets */}
      <Suspense>
        <Tabs tabs={tabs} current={tab} />
      </Suspense>

      {/* Contenu */}
      <div className="space-y-4">
        {tab === 'clients' && (
          <ClientList clients={clients} />
        )}

        {tab === 'devis' && (
          <DevisList devis={devis} clients={clients} />
        )}

        {tab === 'factures' && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-oxi-border bg-oxi-surface py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-oxi-bg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6 text-oxi-text-muted" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-oxi-text-secondary">Module Factures</p>
            <p className="mt-1 text-xs text-oxi-text-muted">Bientôt disponible — Session 7</p>
          </div>
        )}

        {tab === 'contrats' && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-oxi-border bg-oxi-surface py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-oxi-bg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6 text-oxi-text-muted" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-oxi-text-secondary">Module Contrats</p>
            <p className="mt-1 text-xs text-oxi-text-muted">Bientôt disponible — Session 8</p>
          </div>
        )}
      </div>
    </div>
  );
}
