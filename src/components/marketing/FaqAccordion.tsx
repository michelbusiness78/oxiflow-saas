'use client';

import { useState } from 'react';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'OxiFlow fonctionne-t-il sur mobile ?',
    a: 'Oui, OxiFlow est une application web progressive, entièrement responsive. Vos techniciens peuvent remplir leurs rapports depuis leur smartphone sur le chantier, même avec une connexion limitée.',
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Vos données sont hébergées en Europe (Supabase EU), chiffrées en transit (TLS 1.3) et au repos. Chaque compte est isolé par tenant — aucun croisement de données entre entreprises.',
  },
  {
    q: 'Puis-je importer mes données existantes ?',
    a: 'Oui, notre équipe vous accompagne à l\'onboarding pour importer vos clients, devis et historique depuis Excel, CSV ou d\'autres logiciels. L\'import manuel est aussi disponible.',
  },
  {
    q: "L'agent vocal fonctionne-t-il sans internet ?",
    a: "L'agent vocal IA nécessite une connexion internet pour le traitement du langage naturel. Les autres fonctionnalités de l'application restent accessibles en mode dégradé hors-ligne.",
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Vous bénéficiez de 14 jours gratuits, sans carte bancaire, sans engagement. Vous accédez à toutes les fonctionnalités du plan Team. À la fin de l'essai, vous choisissez votre plan ou arrêtez — sans frais.",
  },
  {
    q: 'Puis-je changer de plan ?',
    a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment depuis votre espace. La facturation est au prorata du mois en cours.",
  },
  {
    q: 'OxiFlow est-il conforme RGPD ?',
    a: "Entièrement. Vous restez propriétaire de vos données, que vous pouvez exporter ou supprimer à tout moment. Nous ne les revendons jamais. Notre DPA (Data Processing Agreement) est disponible sur demande.",
  },
  {
    q: 'Combien de temps prend la prise en main ?',
    a: "La plupart de nos clients sont opérationnels en moins de 30 minutes. L'interface est conçue pour être intuitive, et un guide de démarrage rapide est inclus à l'inscription.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <dl className="space-y-2">
      {FAQ.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 overflow-hidden bg-white transition-shadow hover:shadow-sm"
        >
          <dt>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={open === i}
            >
              <span className="font-medium text-[#1B2A4A] text-sm sm:text-base">{item.q}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </dt>
          {open === i && (
            <dd className="px-5 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
              {item.a}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
