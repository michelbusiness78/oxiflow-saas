'use client';

const PLANS = {
  trial: {
    label:    'Essai gratuit',
    color:    'bg-gray-100 text-gray-700',
    users:    3,
    features: ['Tous les modules', '3 utilisateurs', 'Support email'],
  },
  solo: {
    label:    'Solo',
    color:    'bg-blue-100 text-blue-700',
    users:    1,
    features: ['Tous les modules', '1 utilisateur', 'Support email'],
  },
  team: {
    label:    'Team',
    color:    'bg-indigo-100 text-indigo-700',
    users:    5,
    features: ['Tous les modules', '5 utilisateurs', 'Support prioritaire', 'Export comptable'],
  },
  pro: {
    label:    'Pro',
    color:    'bg-purple-100 text-purple-700',
    users:    15,
    features: ['Tous les modules', '15 utilisateurs', 'Support dédié', 'Export comptable', 'API access'],
  },
};

interface Props {
  plan:       string;
  plan_debut: string;
  plan_fin:   string;
}

export function Subscription({ plan, plan_debut, plan_fin }: Props) {
  const p       = PLANS[plan as keyof typeof PLANS] ?? PLANS.trial;
  const debut   = new Date(plan_debut);
  const fin     = new Date(plan_fin);
  const now     = new Date();
  const isTrial = plan === 'trial';

  const totalMs   = Math.max(1, fin.getTime() - debut.getTime());
  const elapsedMs = Math.min(now.getTime() - debut.getTime(), totalMs);
  const pct       = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
  const daysLeft  = Math.max(0, Math.ceil((fin.getTime() - now.getTime()) / 86_400_000));
  const isExpired = now > fin;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Plan actuel */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-oxi-text">Plan actuel</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.color}`}>
                {p.label}
              </span>
              {isExpired && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  Expiré
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-oxi-text-muted">
              {isTrial ? "Période d'essai" : 'Abonnement'} — jusqu'au{' '}
              {fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Barre de progression trial */}
        {isTrial && (
          <div className="mb-4 rounded-xl border border-oxi-border bg-oxi-bg p-4">
            <div className="flex justify-between text-xs text-oxi-text-muted mb-2">
              <span>
                {isExpired
                  ? "Essai expiré"
                  : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
                }
              </span>
              <span>{pct}% écoulé</span>
            </div>
            <div className="h-2 rounded-full bg-oxi-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isExpired  ? 'bg-red-500'      :
                  pct > 75   ? 'bg-orange-400'   :
                               'bg-oxi-primary'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {!isExpired && daysLeft <= 3 && (
              <p className="mt-2 text-xs text-orange-600 font-medium">
                Votre essai se termine bientôt. Activez un plan pour continuer.
              </p>
            )}
          </div>
        )}

        {/* Features incluses */}
        <ul className="space-y-2">
          {p.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-oxi-text-secondary">
              <svg className="h-4 w-4 shrink-0 text-oxi-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:flex-row border-t border-oxi-border pt-5">
        <a
          href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ?? '#'}
          className="flex-1 rounded-lg border border-oxi-border px-4 py-2.5 text-center text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
        >
          Gérer mon abonnement
        </a>
        <a
          href="/tarifs"
          className="flex-1 rounded-lg bg-oxi-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors"
        >
          Changer de plan
        </a>
      </div>

      <p className="text-xs text-oxi-text-muted">
        Pour toute question sur votre facturation, contactez{' '}
        <a href="mailto:support@oxiflow.fr" className="text-oxi-primary hover:underline">
          support@oxiflow.fr
        </a>
      </p>
    </div>
  );
}
