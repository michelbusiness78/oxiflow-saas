import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { CheckoutButton, PortalButton } from '@/components/stripe/SubscriptionActions';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface Subscription {
  id:                     string;
  plan:                   'solo' | 'team' | 'pro';
  status:                 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_end:     string | null;
  cancel_at:              string | null;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    key:      'solo' as const,
    label:    'Solo',
    price:    '29€',
    desc:     'Pour les dirigeants et indépendants',
    popular:  false,
    priceEnv: 'STRIPE_PRICE_SOLO',
    features: ['1 utilisateur', 'Commerce (devis, factures)', 'Pilotage & KPIs', '50 requêtes vocales / mois'],
  },
  {
    key:      'team' as const,
    label:    'Team',
    price:    '59€',
    desc:     'Pour les équipes en croissance',
    popular:  true,
    priceEnv: 'STRIPE_PRICE_TEAM',
    features: ['5 utilisateurs', 'Tous les modules', 'Gestion terrain', '200 requêtes vocales / mois', 'Support prioritaire'],
  },
  {
    key:      'pro' as const,
    label:    'Pro',
    price:    '99€',
    desc:     'Pour les PME structurées',
    popular:  false,
    priceEnv: 'STRIPE_PRICE_PRO',
    features: ['15 utilisateurs', 'Tous les modules', 'Multi-sites', '500 requêtes vocales / mois', 'Support téléphonique'],
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
  solo: 'Solo',
  team: 'Team',
  pro:  'Pro',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AbonnementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  // Récupère le tenant de l'utilisateur
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) redirect('/pilotage');

  // Récupère l'abonnement actuel
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, plan, status, current_period_end, cancel_at')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle() as { data: Subscription | null };

  // Récupère les priceIds depuis les env vars (server-side uniquement)
  const priceIds: Record<string, string> = {
    solo: process.env.STRIPE_PRICE_SOLO ?? '',
    team: process.env.STRIPE_PRICE_TEAM ?? '',
    pro:  process.env.STRIPE_PRICE_PRO  ?? '',
  };

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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 shadow-oxi-sm">
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

      {/* ── Abonnement annulé — rappel ────────────────────────────────────── */}
      {sub?.status === 'canceled' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          Votre abonnement est annulé. Choisissez un plan ci-dessous pour réactiver votre accès.
        </div>
      )}

      {/* ── Plans disponibles ─────────────────────────────────────────────── */}
      {!isActive && (
        <div>
          <p className="text-sm font-semibold text-slate-500 mb-4">
            Choisissez un plan pour démarrer votre essai gratuit de 14 jours.
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Sans carte bancaire · Annulation à tout moment
          </p>
        </div>
      )}

      <div className={`grid gap-5 ${isActive ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
        {PLANS.map((plan) => {
          const isCurrent = sub?.plan === plan.key && isActive;
          const priceId   = priceIds[plan.key];

          return (
            <article
              key={plan.key}
              className={[
                'relative rounded-2xl flex flex-col',
                plan.popular && !isCurrent
                  ? 'border-2 border-[#2563EB] bg-white shadow-lg shadow-blue-50'
                  : isCurrent
                    ? 'border-2 border-blue-600 bg-blue-50'
                    : 'border border-slate-200 bg-white shadow-sm',
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
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-3xl font-extrabold text-slate-800">{plan.price}</span>
                  <span className="text-slate-400 text-sm mb-0.5">/mois</span>
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" aria-hidden>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
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
    </div>
  );
}
