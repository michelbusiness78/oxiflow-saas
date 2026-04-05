import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Clock } from '@/components/ui/Clock';

// ─── Modules du hub ───────────────────────────────────────────────────────────

const MODULE_CARDS = [
  {
    key:          'pilotage',
    badge:        'DIRECTION',
    badgeCls:     'bg-green-700',
    borderCls:    'border-l-green-600',
    iconBgCls:    'bg-green-600/15 text-green-400',
    icon:         '📊',
    title:        'Pilotage',
    subtitle:     'Pilotage financier, tableaux de bord multi-sociétés',
    href:         '/pilotage/dashboard',
    roleKey:      '/pilotage',
  },
  {
    key:          'commerce',
    badge:        'COMMERCIAL',
    badgeCls:     'bg-orange-700',
    borderCls:    'border-l-orange-600',
    iconBgCls:    'bg-orange-600/15 text-orange-400',
    icon:         '💼',
    title:        'Commerce',
    subtitle:     'Devis, facturation, catalogue produits, suivi clients',
    href:         '/commerce',
    roleKey:      '/commerce',
  },
  {
    key:          'chef-projet',
    badge:        'PROJETS',
    badgeCls:     'bg-blue-700',
    borderCls:    'border-l-blue-600',
    iconBgCls:    'bg-blue-600/15 text-blue-400',
    icon:         '📋',
    title:        'Chef de Projet',
    subtitle:     'Planning équipe, suivi chantiers, commandes',
    href:         '/chef-projet',
    roleKey:      '/chef-projet',
  },
  {
    key:          'technicien',
    badge:        'TERRAIN',
    badgeCls:     'bg-emerald-700',
    borderCls:    'border-l-emerald-500',
    iconBgCls:    'bg-emerald-600/15 text-emerald-400',
    icon:         '🔧',
    title:        'Technicien',
    subtitle:     'Interventions, checklist, base matériel',
    href:         '/technicien',
    roleKey:      '/technicien',
  },
  {
    key:          'rh',
    badge:        'RH',
    badgeCls:     'bg-red-700',
    borderCls:    'border-l-red-600',
    iconBgCls:    'bg-red-600/15 text-red-400',
    icon:         '👤',
    title:        'Espace RH',
    subtitle:     'Notes de frais, congés, soldes CP/RTT',
    href:         '/rh',
    roleKey:      '/rh',
  },
  {
    key:          'projets',
    badge:        'OPÉRATIONNEL',
    badgeCls:     'bg-violet-700',
    borderCls:    'border-l-violet-600',
    iconBgCls:    'bg-violet-600/15 text-violet-400',
    icon:         '📁',
    title:        'Projets & Dossiers',
    subtitle:     'Suivi projets, SAV et fiches clients',
    href:         '/projets',
    roleKey:      '/projets',
  },
] as const;

const ROLE_ALLOWED: Record<string, string[]> = {
  dirigeant:   ['/pilotage', '/commerce', '/projets', '/technicien', '/chef-projet', '/rh'],
  commercial:  ['/pilotage', '/commerce'],
  technicien:  ['/technicien'],
  chef_projet: ['/pilotage', '/projets', '/chef-projet'],
  rh:          ['/pilotage', '/rh'],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PilotagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role        = profile?.role ?? 'dirigeant';
  const allowedKeys = ROLE_ALLOWED[role] ?? ROLE_ALLOWED.dirigeant;
  const cards       = MODULE_CARDS.filter((c) => allowedKeys.includes(c.roleKey));

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    /* Full-bleed dark container — breaks out of DashboardShell padding */
    <div className="-mx-4 -mt-4 -mb-20 md:-mx-6 md:-mt-6 md:-mb-6 flex min-h-[calc(100dvh-3.5rem)] flex-col bg-slate-900">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-6 pb-4 md:px-8 md:pt-8">
        <div>
          <p className="text-xl font-bold tracking-tight">
            <span className="text-white">Oxi</span>
            <span className="text-blue-400">Flow</span>
          </p>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-slate-600">
            Portail modules
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold tabular-nums text-white">
            <Clock />
          </p>
          <p className="mt-0.5 text-[11px] capitalize text-slate-600">{today}</p>
        </div>
      </div>

      {/* ── Module grid ── */}
      <div className="flex-1 px-4 pb-4 md:px-8 md:pb-8">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <a
              key={card.key}
              href={card.href}
              className={[
                'group relative flex flex-col rounded-2xl border border-white/[0.06]',
                'border-l-4 bg-white/[0.04] p-4 backdrop-blur-sm',
                'transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-xl',
                card.borderCls,
              ].join(' ')}
            >
              {/* Badge rôle */}
              <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ${card.badgeCls}`}>
                {card.badge}
              </span>

              {/* Icône */}
              <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl ${card.iconBgCls}`}>
                {card.icon}
              </div>

              {/* Texte */}
              <p className="text-sm font-bold leading-tight text-white">{card.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">{card.subtitle}</p>

              {/* CTA ghost */}
              <div className="mt-4">
                <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.15] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition-colors group-hover:border-white/30 group-hover:text-white/90">
                  Accéder →
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-5 py-3 md:px-8">
        <span className="text-[11px] text-slate-700">OxiFlow · v1.0</span>
        <span className="text-[11px] capitalize text-slate-700">{today}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          Portail actif
        </span>
      </div>
    </div>
  );
}
