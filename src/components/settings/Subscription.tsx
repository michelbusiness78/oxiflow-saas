'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalButton } from '@/components/stripe/SubscriptionActions';

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = {
  trial: {
    label:      'Essai gratuit',
    color:      'bg-gray-100 text-gray-700',
    users:      3,
    voiceLimit: 200,
    features:   ['Tous les modules', '3 utilisateurs', 'Support email'],
  },
  solo: {
    label:      'Solo',
    color:      'bg-blue-100 text-blue-700',
    users:      1,
    voiceLimit: 50,
    features:   ['Tous les modules', '1 utilisateur', 'Support email'],
  },
  team: {
    label:      'Team',
    color:      'bg-indigo-100 text-indigo-700',
    users:      5,
    voiceLimit: 200,
    features:   ['Tous les modules', '5 utilisateurs', 'Support prioritaire', 'Export comptable'],
  },
  pro: {
    label:      'Pro',
    color:      'bg-purple-100 text-purple-700',
    users:      15,
    voiceLimit: 500,
    features:   ['Tous les modules', '15 utilisateurs', 'Support dédié', 'Export comptable', 'API access'],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id:     string;
  date:   string;
  amount: string;
  status: string;
  pdfUrl: string | null;
}

interface Props {
  plan:        string;
  plan_debut:  string;
  plan_fin:    string;
  usageCount?: number;
  periodEnd?:  string | null;
}

// ─── Badge statut facture ─────────────────────────────────────────────────────

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        Payée
      </span>
    );
  }
  if (status === 'open') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
      Échouée
    </span>
  );
}

// ─── Bouton portail secondaire ────────────────────────────────────────────────

function PortalLinkButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm text-blue-600 hover:underline disabled:opacity-60"
    >
      {loading ? 'Redirection…' : label}
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function Subscription({ plan, plan_debut, plan_fin, usageCount = 0, periodEnd }: Props) {
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

  // ── Usage vocal ────────────────────────────────────────────────────────────
  const usageLimit = p.voiceLimit;
  const usagePct   = Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const usageColor =
    usagePct > 80 ? '#DC2626' :
    usagePct > 60 ? '#F59E0B' :
                    '#16A34A';

  const resetDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : isTrial
    ? fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── Factures ───────────────────────────────────────────────────────────────
  const [invoices,        setInvoices]        = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    fetch('/api/invoices')
      .then((r) => (r.ok ? r.json() : { invoices: [] }))
      .then((data: { invoices?: Invoice[] }) => setInvoices(data.invoices ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Plan actuel ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-800">Plan actuel</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.color}`}>
                {p.label}
              </span>
              {isExpired && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  Expiré
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {isTrial ? "Période d'essai" : 'Abonnement'} — jusqu'au{' '}
              {fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Barre de progression trial */}
        {isTrial && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>
                {isExpired
                  ? "Essai expiré"
                  : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
                }
              </span>
              <span>{pct}% écoulé</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isExpired  ? 'bg-red-500'      :
                  pct > 75   ? 'bg-orange-400'   :
                               'bg-blue-600'
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
            <li key={f} className="flex items-center gap-2 text-sm text-slate-500">
              <svg className="h-4 w-4 shrink-0 text-oxi-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Mon usage vocal ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Mon usage
        </p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-slate-600">Requêtes vocales ce mois</span>
          <span className="text-sm font-semibold text-slate-800">
            {usageCount} / {usageLimit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width:           `${usagePct}%`,
              backgroundColor: usageColor,
              borderRadius:    '4px',
            }}
          />
        </div>
        {resetDate && (
          <p className="mt-2 text-xs text-slate-400">
            Réinitialisation le {resetDate}
          </p>
        )}
        {usagePct > 80 && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">
              Vous approchez de votre limite. Passez au plan supérieur pour plus de requêtes vocales.
            </p>
          </div>
        )}
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row border-t border-slate-200 pt-5">
        <PortalButton />
        <Link
          href="/pilotage/abonnement"
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Changer de plan
        </Link>
      </div>

      {/* ── Mes factures ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Mes factures
        </p>

        {invoicesLoading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune facture pour le moment.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm text-slate-600">{inv.date}</span>
                  <span className="text-sm font-medium text-slate-700">{inv.amount}</span>
                  <InvoiceStatusBadge status={inv.status} />
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Télécharger PDF
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <PortalLinkButton label="Voir tout l'historique →" />
            </div>
          </>
        )}
      </div>

      {/* ── Vos produits Oxilabs ────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Vos produits Oxilabs
        </p>
        <div
          className="flex items-center gap-4 rounded-xl border p-4"
          style={{
            background:   'rgba(8, 145, 178, 0.05)',
            borderColor:  'rgba(8, 145, 178, 0.25)',
          }}
        >
          {/* Icône OxiNex */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: '#0891B2' }}
          >
            Nx
          </div>

          {/* Texte */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">OxiNex</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: '#0891B2' }}
              >
                Nouveau
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Support technique IA pour installateurs — Résolvez vos pannes 10× plus vite
            </p>
          </div>

          {/* Bouton */}
          <a
            href="https://oxinex.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#0891B2] hover:text-white"
            style={{ borderColor: '#0891B2', color: '#0891B2' }}
          >
            Découvrir →
          </a>
        </div>
      </div>

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-slate-400">
        Pour toute question sur votre facturation, contactez{' '}
        <a href="mailto:contact@oxilabs.fr" className="text-blue-600 hover:underline">
          contact@oxilabs.fr
        </a>
      </p>
    </div>
  );
}
