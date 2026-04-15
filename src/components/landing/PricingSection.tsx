'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key:           'solo',
    label:         'Solo',
    desc:          'Pour les indépendants',
    monthlyPrice:  19,
    yearlyMonthly: 14.25,
    yearlyTotal:   171,
    yearlySavings: 57,
    popular:       false,
    features: [
      '1 utilisateur',
      '1 société',
      'Tous les modules',
      'Agent vocal IA : 50 req/mois',
      '1 Go stockage',
      'Support email',
    ],
    delay: 'lp-animate-d1',
  },
  {
    key:           'team',
    label:         'Team',
    desc:          'Pour les petites équipes',
    monthlyPrice:  29,
    yearlyMonthly: 21.75,
    yearlyTotal:   261,
    yearlySavings: 87,
    popular:       true,
    features: [
      "Jusqu'à 5 utilisateurs",
      '1 société',
      'Tous les modules',
      'Agent vocal IA : 200 req/mois',
      '5 Go stockage',
      'Support email + chat',
    ],
    delay: 'lp-animate-d2',
  },
  {
    key:           'pro',
    label:         'Pro',
    desc:          'Pour les PME structurées',
    monthlyPrice:  59,
    yearlyMonthly: 44.25,
    yearlyTotal:   531,
    yearlySavings: 177,
    popular:       false,
    features: [
      "Jusqu'à 15 utilisateurs",
      'Multi-sociétés illimité',
      'Tous les modules',
      'Agent vocal IA : 500 req/mois',
      '20 Go stockage',
      'Support prioritaire téléphone',
    ],
    delay: 'lp-animate-d3',
  },
] as const;

// ─── CheckIcon ────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-[#2563EB] mt-0.5" aria-hidden>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(true); // annuel pré-sélectionné

  return (
    <section className="py-20 sm:py-24 bg-[#f8fafc]" id="tarifs" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* En-tête */}
        <div className="text-center max-w-2xl mx-auto mb-10 lp-animate">
          <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">Tarifs</p>
          <h2 id="pricing-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
            Simple. Transparent. Sans surprise.
          </h2>
          <p className="text-slate-600 text-lg">
            14 jours gratuits, sans carte bancaire. Changez de plan à tout moment.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="flex rounded-full border border-[#dde3f0] bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={[
                'rounded-full px-5 py-2 text-sm font-semibold transition-all',
                !isYearly
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={[
                'rounded-full px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2',
                isYearly
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              Annuel
              <span className={[
                'rounded-full px-2 py-0.5 text-xs font-bold transition-colors',
                isYearly ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700',
              ].join(' ')}>
                −25%
              </span>
            </button>
          </div>
          {isYearly && (
            <span className="text-sm text-green-600 font-semibold animate-in fade-in duration-200">
              🎉 2 mois offerts
            </span>
          )}
        </div>

        {/* Colonnes de plans */}
        <div className="grid sm:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => (
            <article
              key={plan.key}
              className={[
                'relative rounded-2xl flex flex-col lp-animate',
                plan.delay,
                plan.popular
                  ? 'border-2 border-[#2563EB] bg-white shadow-xl shadow-blue-100'
                  : 'border border-[#dde3f0] bg-white shadow-sm',
              ].join(' ')}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#2563EB] px-4 py-1 text-xs font-semibold text-white shadow-sm">
                    Populaire
                  </span>
                </div>
              )}

              <div className="p-7 flex-1">
                <h3 className="font-bold text-xl text-[#1B2A4A] mb-1">{plan.label}</h3>
                <p className="text-sm text-slate-500 mb-5">{plan.desc}</p>

                {/* Bloc prix */}
                <div className="mb-6 min-h-[72px]">
                  {isYearly ? (
                    <>
                      <div className="flex items-end gap-2 flex-wrap">
                        <span className="text-lg text-slate-400 line-through leading-none">
                          {plan.monthlyPrice}€
                        </span>
                        <span className="text-4xl font-extrabold text-green-600 leading-none">
                          {plan.yearlyMonthly.toFixed(2).replace('.', ',')}€
                        </span>
                        <span className="text-slate-500 text-sm pb-0.5">/mois</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">
                        Soit {plan.yearlyTotal}€/an — Économisez {plan.yearlySavings}€
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-extrabold text-[#1B2A4A] leading-none">
                          {plan.monthlyPrice}€
                        </span>
                        <span className="text-slate-500 text-sm pb-0.5">/mois</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">Facturation mensuelle</p>
                    </>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span className="text-sm text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-7 pb-7">
                <Link
                  href="/register"
                  className={[
                    'block w-full text-center rounded-xl py-3 text-sm font-semibold transition-colors',
                    plan.popular
                      ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-md shadow-blue-200'
                      : 'border border-slate-200 text-[#1B2A4A] hover:bg-slate-50',
                  ].join(' ')}
                >
                  Commencer l&apos;essai gratuit
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Mentions sous les plans */}
        <div className="text-center mt-8 space-y-1 lp-animate">
          <p className="text-sm text-slate-500">14 jours gratuits, sans carte bancaire</p>
          <p className="text-xs text-slate-400">Tous les prix sont HT · Annulation à tout moment</p>
        </div>

      </div>
    </section>
  );
}
