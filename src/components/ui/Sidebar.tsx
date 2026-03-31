'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { navModules } from '@/lib/theme';
import { NavIcon } from './NavIcon';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  isOpen:        boolean;
  onClose:       () => void;
  allowedHrefs?: string[];
  showSettings?: boolean;
  moduleCounts?: Record<string, number>;
  userName?:     string;
  userRole?:     string;
}

const ROLE_LABELS: Record<string, string> = {
  dirigeant:   'DIRECTION',
  commercial:  'COMMERCIAL',
  chef_projet: 'CHEF DE PROJET',
  technicien:  'TERRAIN',
  rh:          'RESSOURCES HUMAINES',
};

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-orange-600', 'bg-rose-600', 'bg-cyan-600',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Sidebar({
  isOpen,
  onClose,
  allowedHrefs,
  showSettings,
  moduleCounts,
  userName = '',
  userRole = '',
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const visibleModules = allowedHrefs
    ? navModules.filter((m) => allowedHrefs.includes(m.href))
    : navModules;

  const initials  = userName ? getInitials(userName) : 'U';
  const roleLabel = ROLE_LABELS[userRole] ?? userRole.toUpperCase();
  const avatarCls = userName ? avatarColor(userName) : 'bg-blue-600';

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 flex h-full w-[230px] flex-col',
          'bg-[#0f172a] transition-transform duration-300 ease-in-out',
          'md:translate-x-0 md:static md:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* ── Header gradient ── */}
        <div className="flex h-16 shrink-0 flex-col justify-center gap-0.5 px-4 bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]">
          <div className="flex items-center justify-between">
            <Link href="/pilotage" className="flex items-baseline" onClick={onClose}>
              <span className="text-base font-bold tracking-tight text-white">Oxi</span>
              <span className="text-base font-bold tracking-tight text-blue-300">Flow</span>
            </Link>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/15 hover:text-white transition-colors md:hidden"
              aria-label="Fermer le menu"
            >
              <NavIcon name="close" className="w-4 h-4" />
            </button>
          </div>
          {roleLabel && (
            <p className="text-[9px] font-semibold uppercase tracking-widest text-blue-200/70 leading-none">
              {roleLabel}
            </p>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Modules
          </p>
          <ul className="space-y-0.5">
            {visibleModules.map((module) => {
              const isActive =
                pathname === module.href ||
                pathname.startsWith(module.href + '/');
              const count = moduleCounts?.[module.href];
              return (
                <li key={module.key}>
                  <Link
                    href={module.href}
                    onClick={onClose}
                    className={[
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-blue-500/[0.12] text-blue-400 font-semibold'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
                    ].join(' ')}
                  >
                    <NavIcon
                      name={module.icon as Parameters<typeof NavIcon>[0]['name']}
                      className={[
                        'w-4 h-4 shrink-0',
                        isActive
                          ? 'text-blue-400'
                          : 'text-slate-600 group-hover:text-slate-400',
                      ].join(' ')}
                    />
                    <span className="flex-1">{module.label}</span>
                    {count != null && count > 0 && (
                      <span
                        className={[
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          isActive
                            ? 'bg-blue-500/[0.18] text-blue-400'
                            : 'bg-slate-200/10 text-slate-500',
                        ].join(' ')}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-white/[0.06] p-3 space-y-0.5">
          {showSettings && (
            <Link
              href="/pilotage/parametres"
              onClick={onClose}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                pathname === '/pilotage/parametres'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300',
              ].join(' ')}
            >
              <NavIcon name="settings" className="w-4 h-4 shrink-0" />
              <span>Paramètres</span>
            </Link>
          )}

          {/* User row */}
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${avatarCls}`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-300">
                {userName || 'Utilisateur'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Déconnexion"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white/[0.08] hover:text-slate-300 transition-colors"
            >
              <NavIcon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
