import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CheckoutButton, PortalButton } from '@/components/stripe/SubscriptionActions';
import Link from 'next/link';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface Subscription {
  id:                     string;
  plan:                   string;
  status:                 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_end:     string | null;
  cancel_at:              string | null;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key:           'starter' as const,
    label:         'Starter',
    desc:          'Pour les indépendants',
    popular:       false,
    monthlyPrice:  '15€',
    yearlyPrice:   '11,25€',
    yearlyTotal:   '135€/an',
    yearlySavings: 'Économisez 45€',
    features: [
      '1 utilisateur',
      '1 société',
      'Devis & Factures',
      'Catalogue produits',
      '50 requêtes vocales IA/mois',
    ],
  },
  {
    key:           'team' as const,
    label:         'Team',
    desc:          'Pour les petites équipes',
    popular:       true,
    monthlyPrice:  '39€',
    yearlyPrice:   '29,25€',
    yearlyTotal:   '351€/an',
    yearlySavings: 'Économisez 117€',
    features: [
      '5 utilisateurs',
      '1 société',
      'Tous les modules',
      'Gestion terrain & techniciens',
      '200 requêtes vocales IA/mois',
      'Calendrier partagé',
    ],
  },
  {
    key:           'pro' as const,
    label:         'Pro',
    desc:          'Pour les PME structurées',
    popular:       false,
    monthlyPrice:  '69€',
    yearlyPrice:   '51,75€',
    yearlyTotal:   '621€/an',
    yearlySavings: 'Économisez 207€',
    features: [
      '15 utilisateurs',
      'Multi-sociétés illimité',
      'Tous les modules',
      'Agent vocal IA avancé (500 req/mois)',
      'Support prioritaire',
      'Connecteurs API (bientôt)',
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Subscription['status'], string> = {
  trialing:  'Essai gratuit en cours',
  active:    'Actif',
  past_due:  'Paiement en retard',
  canceled:  'Annulé',
};

const STATUS_COLOR: Record<Subscription['status'], string> = {
  trialing:  'bg-blue-50   text-blue-700   border-blue-200',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due:  'bg-red-50    text-red-700    border-red-200',
  canceled:  'bg-slate-100 text-slate-600  border-slate-200',
};

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  team:    'Team',
  pro:     'Pro',
  solo:    'Solo',  // rétrocompatibilité anciens abonnements
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" aria-hidden>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ billing?: string }>;
}

export default async function AbonnementPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) redirect('/pilotage');

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, plan, status, current_period_end, cancel_at')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle() as { data: Subscription | null };

  const params    = await searchParams;
  const isYearly  = params?.billing !== 'monthly';

  // Price IDs depuis les variables d'environnement
  const priceIds: Record<string, string> = {
    starter_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY ?? '',
    starter_yearly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY  ?? '',
    team_monthly:    process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY    ?? '',
    team_yearly:     process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY     ?? '',
    pro_monthly:     process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY     ?? '',
    pro_yearly:      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY      ?? '',
  };

  function getPriceId(key: string): string {
    return isYearly ? (priceIds[`${key}_yearly`] ?? '') : (priceIds[`${key}_monthly`] ?? '');
  }

  const isActive = sub && ['trialing', 'active', 'past_due'].includes(sub.status);

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Abonnement</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Gérez votre plan et votre facturation
        </p>
      </div>

      {/* ── Abonnement actif ─────────────────────────────────────────────── */}
      {isActive && sub && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-lg font-bold text-slate-800">
                  Plan {PLAN_LABEL[sub.plan] ?? sub.plan}
                </p>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[sub.status]}`}>
                  {STATUS_LABEL[sub.status]}
                </span>
              </div>
              <dl className="space-y-1 text-sm">
                {sub.status === 'trialing' && sub.current_period_end && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Fin d&apos;essai :</dt>
                    <dd className="font-semibold text-slate-700">{fmtDate(sub.current_period_end)}</dd>
                  </div>
                )}
                {sub.status === 'active' && sub.current_period_end && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Prochain renouvellement :</dt>
                    <dd className="font-semibold text-slate-700">{fmtDate(sub.current_period_end)}</dd>
                  </div>
                )}
                {sub.status === 'past_due' && (
                  <div className="flex gap-2">
                    <dt className="text-red-600 font-medium">
                      Votre paiement a échoué. Mettez à jour votre moyen de paiement pour éviter l&apos;interruption du service.
                    </dt>
                  </div>
                )}
                {sub.cancel_at && sub.status !== 'canceled' && (
                  <div className="flex gap-2">
                    <dt className="text-slate-400">Annulation prévue le :</dt>
                    <dd className="font-medium text-red-600">{fmtDate(sub.cancel_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <PortalButton />
          </div>
        </div>
      )}

      {/* ── Abonnement annulé ─────────────────────────────────────────────── */}
      {sub?.status === 'canceled' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          Votre abonnement est annulé. Choisissez un plan ci-dessous pour réactiver votre accès.
        </div>
      )}

      {/* ── Intro plans ───────────────────────────────────────────────────── */}
      {!isActive && (
        <div>
          <p className="text-sm font-semibold text-slate-500 mb-1">
            Choisissez un plan pour démarrer votre essai gratuit de 14 jours.
          </p>
          <p className="text-xs text-slate-400">
            Sans carte bancaire · Annulation à tout moment
          </p>
        </div>
      )}

      {/* ── Toggle Mensuel / Annuel ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-[#dde3f0] bg-white p-1 shadow-sm">
          <Link
            href="/pilotage/abonnement?billing=monthly"
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              !isYearly
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Mensuel
          </Link>
          <Link
            href="/pilotage/abonnement?billing=yearly"
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-2',
              isYearly
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Annuel
            <span className={[
              'rounded-full px-1.5 py-0.5 text-xs font-bold',
              isYearly ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700',
            ].join(' ')}>
              −25%
            </span>
          </Link>
        </div>
        {isYearly && (
          <span className="text-sm text-green-600 font-semibold">2 mois offerts</span>
        )}
      </div>

      {/* ── Grille des plans ──────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = sub?.plan === plan.key && isActive;
          const priceId   = getPriceId(plan.key);

          return (
            <article
              key={plan.key}
              className={[
                'relative rounded-2xl flex flex-col',
                plan.popular && !isCurrent
                  ? 'border-2 border-[#2563EB] bg-white shadow-lg shadow-blue-50'
                  : isCurrent
                    ? 'border-2 border-blue-600 bg-blue-50'
                    : 'border border-[#dde3f0] bg-white shadow-sm',
              ].join(' ')}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#2563EB] px-4 py-1 text-xs font-semibold text-white shadow-sm">
                    Populaire
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                    Plan actuel
                  </span>
                </div>
              )}

              <div className="p-6 flex-1">
                <h2 className="font-bold text-lg text-slate-800 mb-1">{plan.label}</h2>
                <p className="text-xs text-slate-400 mb-4">{plan.desc}</p>

                {/* Prix */}
                <div className="mb-5 min-h-[60px]">
                  {isYearly ? (
                    <>
                      <div className="flex items-end gap-2 flex-wrap">
                        <span className="text-base text-slate-400 line-through leading-none">
                          {plan.monthlyPrice}
                        </span>
                        <span className="text-3xl font-extrabold text-green-600 leading-none">
                          {plan.yearlyPrice}
                        </span>
                        <span className="text-slate-400 text-sm pb-0.5">/mois</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {plan.yearlyTotal} — {plan.yearlySavings}
                      </p>
                    </>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-extrabold text-slate-800 leading-none">
                        {plan.monthlyPrice}
                      </span>
                      <span className="text-slate-400 text-sm pb-0.5">/mois</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckIcon />
                      <span className="text-sm text-slate-500">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6">
                {isCurrent ? (
                  <PortalButton />
                ) : (
                  <CheckoutButton
                    priceId={priceId}
                    label="Choisir ce plan"
                    variant={plan.popular ? 'primary' : 'outline'}
                  />
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">Tous les prix sont HT</p>
    </div>
  );
}
