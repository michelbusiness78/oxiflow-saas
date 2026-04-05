import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { PricingSection } from '@/components/landing/PricingSection';

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'OxiFlow — Gérez votre PME avec la voix',
  description:
    'OxiFlow centralise commerce, terrain, projets et RH dans un seul outil. Avec un assistant vocal IA qui comprend vos commandes en français. Essai gratuit 14 jours.',
  openGraph: {
    title: 'OxiFlow — Gérez votre PME avec la voix',
    description:
      'Devis, factures, techniciens, RH et agent vocal IA. La gestion PME intelligente, sans complexité.',
    type:     'website',
    locale:   'fr_FR',
    siteName: 'OxiFlow',
    images: [
      {
        url:    '/og-image.svg',
        width:  1200,
        height: 630,
        alt:    'OxiFlow — Gérez votre PME avec la voix',
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'OxiFlow — Gérez votre PME avec la voix',
    description: 'La gestion PME intelligente avec assistant vocal IA. 14 jours gratuits.',
    images:      ['/og-image.svg'],
  },
};

// ─── Icônes features ──────────────────────────────────────────────────────────

function IconDocumentText() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
function IconWrench() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
    </svg>
  );
}
function IconMicrophone() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );
}
function IconChartBar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

// ─── Mockup dashboard (CSS/SVG) ───────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl select-none" aria-hidden>
      {/* Halo */}
      <div className="absolute inset-0 -m-8 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Browser frame */}
      <div className="relative rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.35)] border border-white/10">
        {/* Chrome bar */}
        <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-400/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <div className="h-3 w-3 rounded-full bg-green-400/80" />
          <div className="ml-3 flex-1 bg-slate-600 rounded-md px-3 py-1 text-[11px] text-slate-300 font-mono">
            app.oxiflow.fr/pilotage
          </div>
        </div>

        {/* Dashboard shell */}
        <div className="flex bg-[#F8FAFC]" style={{ height: '300px' }}>
          {/* Sidebar */}
          <div className="w-14 shrink-0 bg-[#1B2A4A] flex flex-col items-center pt-4 pb-4 gap-3">
            {[
              { bg: 'bg-[#2563EB]', active: true },
              { bg: 'bg-transparent', active: false },
              { bg: 'bg-transparent', active: false },
              { bg: 'bg-transparent', active: false },
            ].map((item, i) => (
              <div key={i} className={`h-9 w-9 rounded-lg ${item.active ? 'bg-[#2563EB]' : 'bg-white/10'} flex items-center justify-center`}>
                <div className="h-3.5 w-3.5 rounded bg-white/60" />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-hidden">
            {/* Top row: 3 KPI cards */}
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {[
                { label: 'CA ce mois', value: '12 480 €', up: '+18%', color: 'text-emerald-600' },
                { label: 'Devis ouverts', value: '7',       up: '3 en attente', color: 'text-amber-600' },
                { label: 'Interventions', value: '12',      up: 'ce mois',      color: 'text-blue-600' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium mb-1">{card.label}</p>
                  <p className="text-base font-bold text-[#1B2A4A] leading-none mb-1">{card.value}</p>
                  <p className={`text-[10px] font-medium ${card.color}`}>{card.up}</p>
                </div>
              ))}
            </div>

            {/* Chart area */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[#1B2A4A]">Évolution CA — 6 mois</p>
                <div className="h-4 w-14 rounded bg-[#EFF6FF]" />
              </div>
              <svg viewBox="0 0 280 60" className="w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lp-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area */}
                <path d="M0,48 C30,44 55,38 80,30 C105,22 130,28 160,18 C190,8 220,16 250,10 C265,7 275,6 280,4 L280,60 L0,60 Z" fill="url(#lp-grad)" />
                {/* Line */}
                <path d="M0,48 C30,44 55,38 80,30 C105,22 130,28 160,18 C190,8 220,16 250,10 C265,7 275,6 280,4" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                {/* Dots */}
                {[[0,48],[80,30],[160,18],[280,4]].map(([x,y],i) => (
                  <circle key={i} cx={x} cy={y} r="3" fill="#2563EB" />
                ))}
              </svg>
            </div>

            {/* Mini tasks */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              <p className="text-[10px] font-semibold text-[#1B2A4A] mb-2">Tâches du jour</p>
              {[
                { done: true,  label: 'Devis Martin SARL envoyé' },
                { done: false, label: 'Relancer Dupont Plomberie' },
                { done: false, label: 'Rapport Nguyen à valider' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  <div className={`h-3.5 w-3.5 rounded shrink-0 border ${t.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`} />
                  <p className={`text-[10px] ${t.done ? 'line-through text-slate-400' : 'text-slate-600'}`}>{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating voice bubble */}
      <div className="absolute -top-5 -right-4 sm:-right-8 bg-white rounded-2xl shadow-xl border border-slate-100 px-3.5 py-2.5 text-xs font-medium text-[#1B2A4A] flex items-center gap-2 max-w-[200px]">
        <span className="h-6 w-6 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0 text-[#2563EB]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
            <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
          </svg>
        </span>
        <span className="text-slate-700">&laquo;&nbsp;Crée un devis pour Martin SARL&nbsp;&raquo;</span>
      </div>

      {/* Floating success badge */}
      <div className="absolute -bottom-4 -left-4 sm:-left-8 bg-[#2563EB] text-white rounded-xl shadow-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        Devis DEV-2025-042 créé
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <MarketingHeader />

      <main className="flex-1">

        {/* ─── HERO ────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden bg-gradient-to-br from-[#0c1628] via-[#1B2A4A] to-[#1a3570] text-white"
          aria-labelledby="hero-title"
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 lg:py-36">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: Text */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-medium text-blue-200 mb-6">
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                  Agent vocal IA intégré
                </div>

                <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-tight tracking-tight mb-6">
                  Gérez votre PME<br />
                  <span className="text-blue-400">avec la voix</span>
                </h1>

                <p className="text-lg text-blue-100/80 leading-relaxed mb-8 max-w-lg">
                  OxiFlow combine gestion commerciale, terrain et pilotage dans un seul outil.
                  Avec un assistant vocal IA qui vous comprend.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  {isLoggedIn ? (
                    <Link
                      href="/pilotage"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
                    >
                      Accéder à mon espace
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                        <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
                    >
                      Essayer gratuitement 14 jours
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                        <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  )}
                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    Voir la démo
                  </a>
                </div>

                <p className="mt-5 text-xs text-blue-200/50">
                  Sans carte bancaire · Annulation à tout moment
                </p>
              </div>

              {/* Right: Mockup */}
              <div className="hidden lg:block">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ─── PROBLÈME / SOLUTION ─────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-slate-50" id="demo" aria-labelledby="pb-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 lp-animate">
              <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">Le constat</p>
              <h2 id="pb-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
                Vous jonglez entre Excel, papier et 5 logiciels différents&nbsp;?
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                La plupart des PME perdent des heures chaque semaine à cause d'outils fragmentés.
                OxiFlow centralise tout en un seul endroit.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-14">
              {[
                {
                  icon: '⏱️',
                  title: 'Temps perdu',
                  desc: "Des heures gaspillées à ressaisir les mêmes données d'un outil à l'autre. Un devis dans Excel, une facture dans un autre logiciel, un rapport papier…",
                  delay: 'lp-animate-d1',
                },
                {
                  icon: '❌',
                  title: 'Erreurs de saisie',
                  desc: "Les données dupliquées engendrent des incohérences : mauvais client sur une facture, TVA incorrecte, numérotation en doublon.",
                  delay: 'lp-animate-d2',
                },
                {
                  icon: '🔭',
                  title: 'Pas de vision globale',
                  desc: "Sans tableau de bord centralisé, impossible de savoir en temps réel si le mois est bon, quelles factures sont impayées, où en sont vos projets.",
                  delay: 'lp-animate-d3',
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lp-animate ${item.delay}`}
                >
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </article>
              ))}
            </div>

            <div className="text-center lp-animate">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-[#EFF6FF] border border-blue-100 px-6 py-4">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#2563EB] shrink-0" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                <p className="text-[#1B2A4A] font-semibold">
                  OxiFlow centralise tout — commerce, terrain, RH et pilotage — dans une seule interface.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FONCTIONNALITÉS ─────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-white" id="fonctionnalites" aria-labelledby="feat-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 lp-animate">
              <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">Fonctionnalités</p>
              <h2 id="feat-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
                Tout ce dont votre PME a besoin
              </h2>
              <p className="text-slate-600 text-lg">
                Six modules intégrés, une seule interface, zéro friction.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: <IconDocumentText />,
                  color: 'bg-blue-50 text-[#2563EB]',
                  title: 'Devis & Factures',
                  desc: 'Créez, envoyez et suivez vos devis et factures en quelques clics. Numérotation automatique, relances, catalogue produits.',
                  delay: 'lp-animate-d1',
                },
                {
                  icon: <IconWrench />,
                  color: 'bg-orange-50 text-orange-600',
                  title: 'Gestion terrain',
                  desc: 'Vos techniciens remplissent leurs rapports depuis le chantier. Géolocalisation, photos, signature client sur smartphone.',
                  delay: 'lp-animate-d2',
                },
                {
                  icon: <IconMicrophone />,
                  color: 'bg-purple-50 text-purple-600',
                  title: 'Agent vocal IA',
                  desc: 'Dictez vos commandes en français, l\'IA comprend et exécute. Créer un devis, ajouter une tâche, consulter un KPI.',
                  delay: 'lp-animate-d3',
                },
                {
                  icon: <IconChartBar />,
                  color: 'bg-emerald-50 text-emerald-600',
                  title: 'Pilotage & KPIs',
                  desc: 'Dashboard temps réel avec CA, factures impayées, taux de transformation. Alertes intelligentes quand ça dérape.',
                  delay: 'lp-animate-d4',
                },
                {
                  icon: <IconFolder />,
                  color: 'bg-sky-50 text-sky-600',
                  title: 'Projets & SAV',
                  desc: 'Du devis au SAV, tout le cycle de vie client. Suivi de chantier, planification, gestion des incidents.',
                  delay: 'lp-animate-d5',
                },
                {
                  icon: <IconUsers />,
                  color: 'bg-rose-50 text-rose-600',
                  title: 'RH simplifié',
                  desc: 'Congés, notes de frais et validation en un clic. Vos collaborateurs soumettent depuis l\'app, vous validez en 10 secondes.',
                  delay: 'lp-animate-d6',
                },
              ].map((feat) => (
                <article
                  key={feat.title}
                  className={`rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 lp-animate ${feat.delay}`}
                >
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${feat.color} mb-4`}>
                    {feat.icon}
                  </div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-2">{feat.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── COMMENT ÇA MARCHE ───────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-slate-50" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 lp-animate">
              <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">Démarrage rapide</p>
              <h2 id="how-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
                Comment ça marche&nbsp;?
              </h2>
              <p className="text-slate-600 text-lg">
                Opérationnel en moins de 30 minutes, vraiment.
              </p>
            </div>

            <div className="relative grid sm:grid-cols-3 gap-8 sm:gap-6">
              {/* Connecting line (desktop) */}
              <div className="hidden sm:block absolute top-7 left-[calc(33.3%+24px)] right-[calc(33.3%+24px)] h-0.5 bg-gradient-to-r from-[#2563EB]/30 via-[#2563EB] to-[#2563EB]/30" aria-hidden />

              {[
                {
                  num: '01',
                  title: 'Inscrivez-vous en 2 minutes',
                  desc: 'Créez votre compte avec votre email. Aucune carte bancaire requise pour l\'essai gratuit de 14 jours.',
                  delay: 'lp-animate-d1',
                },
                {
                  num: '02',
                  title: 'Configurez votre société',
                  desc: 'Renseignez vos informations d\'entreprise, ajoutez vos collaborateurs, importez vos clients existants.',
                  delay: 'lp-animate-d2',
                },
                {
                  num: '03',
                  title: 'Commencez à travailler',
                  desc: 'Créez votre premier devis, planifiez une intervention, ou dites à l\'agent vocal ce dont vous avez besoin.',
                  delay: 'lp-animate-d3',
                },
              ].map((step) => (
                <article key={step.num} className={`text-center lp-animate ${step.delay}`}>
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white text-lg font-bold shadow-lg shadow-blue-200 mb-5">
                    {step.num}
                  </div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-2 text-lg">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TARIFS ──────────────────────────────────────────────────────── */}
        <PricingSection />

        {/* ─── TÉMOIGNAGES ─────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-slate-50" aria-labelledby="testi-title">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 lp-animate">
              <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">Témoignages</p>
              <h2 id="testi-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
                Ils ont simplifié leur quotidien
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  name:    'Thomas M.',
                  role:    'Dirigeant, électricité bâtiment',
                  city:    'Lyon',
                  quote:   'Avant OxiFlow, je perdais 3 heures par semaine à ressaisir des données entre Excel et mon logiciel de facturation. Maintenant, tout est automatique.',
                  stars:   5,
                  delay:   'lp-animate-d1',
                },
                {
                  name:    'Camille D.',
                  role:    'Chef de projet, plomberie chauffage',
                  city:    'Bordeaux',
                  quote:   "L'agent vocal est bluffant. Je dicte mes comptes-rendus de chantier en rentrant dans la voiture, et le rapport est déjà formaté quand j'arrive au bureau.",
                  stars:   5,
                  delay:   'lp-animate-d2',
                },
                {
                  name:    'Sébastien R.',
                  role:    'Gérant, menuiserie & agencement',
                  city:    'Nantes',
                  quote:   'Le tableau de bord en temps réel m\'a permis de voir que 18 000€ de factures dormaient depuis 60 jours. Je les ai relancées en 5 minutes.',
                  stars:   5,
                  delay:   'lp-animate-d3',
                },
              ].map((testi) => (
                <article
                  key={testi.name}
                  className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lp-animate ${testi.delay}`}
                >
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4" aria-label={`${testi.stars} étoiles sur 5`}>
                    {Array.from({ length: testi.stars }).map((_, i) => (
                      <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-400" aria-hidden>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="text-sm text-slate-700 leading-relaxed mb-5">
                    &ldquo;{testi.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-[#1B2A4A] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {testi.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1B2A4A]">{testi.name}</p>
                      <p className="text-xs text-slate-500">{testi.role} · {testi.city}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-white" id="faq" aria-labelledby="faq-title">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center mb-12 lp-animate">
              <p className="text-[#2563EB] text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
              <h2 id="faq-title" className="text-3xl sm:text-4xl font-bold text-[#1B2A4A] mb-4">
                Questions fréquentes
              </h2>
            </div>
            <div className="lp-animate">
              <FaqAccordion />
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ───────────────────────────────────────────────────── */}
        <section
          className="py-20 sm:py-28 bg-gradient-to-br from-[#1B2A4A] to-[#1a3570] text-white text-center"
          aria-labelledby="cta-title"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lp-animate">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/20 mb-8 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-blue-300" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <h2 id="cta-title" className="text-3xl sm:text-5xl font-extrabold mb-5 leading-tight">
              Prêt à simplifier<br />votre gestion&nbsp;?
            </h2>
            <p className="text-blue-100/70 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              Rejoignez les PME qui ont repris le contrôle de leur activité. 14 jours gratuits, configuration en 30 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
              >
                Démarrer mon essai gratuit
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>

            <p className="mt-6 text-xs text-blue-200/40">
              Sans carte bancaire · Annulation à tout moment · RGPD compliant
            </p>
          </div>
        </section>

      </main>

      <MarketingFooter />

      {/* ─── JSON-LD Structured Data ────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'OxiFlow',
            url: 'https://oxiflow.fr',
            description:
              'OxiFlow simplifie la gestion de votre PME : devis, factures, interventions terrain, RH. Avec un assistant vocal IA qui vous comprend.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            inLanguage: 'fr',
            offers: [
              {
                '@type': 'Offer',
                name: 'Starter',
                price: '15',
                priceCurrency: 'EUR',
                description: '1 utilisateur — Tous les modules, agent vocal IA, support email',
                url: 'https://oxiflow.fr/#tarifs',
              },
              {
                '@type': 'Offer',
                name: 'Team',
                price: '29',
                priceCurrency: 'EUR',
                description: "Jusqu'à 5 utilisateurs — Tous les modules, agent vocal IA, support email + chat",
                url: 'https://oxiflow.fr/#tarifs',
              },
              {
                '@type': 'Offer',
                name: 'Pro',
                price: '59',
                priceCurrency: 'EUR',
                description: "Jusqu'à 15 utilisateurs — Multi-sociétés illimité, agent vocal IA, support prioritaire téléphone",
                url: 'https://oxiflow.fr/#tarifs',
              },
            ],
          }),
        }}
      />
    </div>
  );
}
