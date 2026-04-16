'use client';

import { useState } from 'react';
import { ClientList, type Client } from './ClientList';
import { FicheClient } from './FicheClient';
import type { RelanceEntry } from '@/app/actions/invoices';

interface Dossier { id: string; nom: string; statut: string; pct_avancement: number; montant_ht: number | null; date_fin_prevue: string | null; client_id: string; }
interface SendEntry { sent_at: string; to: string; }
interface Devis   { id: string; num: string; statut: string; montant_ttc: number; date: string; client_id: string; send_history?: SendEntry[]; }
interface Facture { id: string; num: string; statut: string; montant_ttc: number; date: string; echeance: string; client_id: string; }
interface Contrat { id: string; type: string; montant_mensuel: number | null; actif: boolean; date_debut: string; date_fin: string | null; client_id: string; }
interface SAV     { id: string; titre: string | null; priorite: string; statut: string; date_ouverture: string; client_id: string; }
interface RelanceHistorique {
  client_id:     string;
  invoice_id:    string;
  number:        string;
  montant_ttc:   number;
  date_echeance: string;
  relance_n1:    RelanceEntry | null;
  relance_n2:    RelanceEntry | null;
  relance_n3:    RelanceEntry | null;
}

interface ClientsTabProps {
  clients:  Client[];
  dossiers: Dossier[];
  devis:    Devis[];
  factures: Facture[];
  contrats: Contrat[];
  savs:     SAV[];
  relances: RelanceHistorique[];
}

export function ClientsTab({ clients, dossiers, devis, factures, contrats, savs, relances }: ClientsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Retour à la liste
        </button>
        <FicheClient
          clients={clients}
          dossiers={dossiers}
          devis={devis}
          factures={factures}
          contrats={contrats}
          savs={savs}
          relances={relances}
          initialSelectedId={selectedId}
        />
      </div>
    );
  }

  return (
    <ClientList clients={clients} onOpenFiche={setSelectedId} />
  );
}
