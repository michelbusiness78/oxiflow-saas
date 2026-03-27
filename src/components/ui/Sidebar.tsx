'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navModules } from '@/lib/theme';
import { NavIcon } from './NavIcon';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 flex h-full w-60 flex-col bg-oxi-navy',
          'transition-transform duration-300 ease-in-out',
          // Mobile : drawer
          'md:translate-x-0 md:static md:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-oxi-primary">
              <span className="text-sm font-bold text-white">O</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              OxiFlow
            </span>
          </Link>

          {/* Bouton fermer (mobile) */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors md:hidden"
            aria-label="Fermer le menu"
          >
            <NavIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-white/30">
            Modules
          </p>
          <ul className="space-y-0.5">
            {navModules.map((module) => {
              const isActive =
                pathname === module.href ||
                pathname.startsWith(module.href + '/');
              return (
                <li key={module.key}>
                  <Link
                    href={module.href}
                    onClick={onClose}
                    className={[
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-oxi-primary text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                  >
                    <NavIcon
                      name={module.icon as Parameters<typeof NavIcon>[0]['name']}
                      className="w-5 h-5 shrink-0"
                    />
                    <span>{module.label}</span>
                    {isActive && (
                      <NavIcon
                        name="chevron-right"
                        className="ml-auto w-4 h-4 opacity-70"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer sidebar */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oxi-primary/20 text-sm font-semibold text-oxi-primary">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">Mon Compte</p>
              <p className="truncate text-xs text-white/40">admin@oxiflow.fr</p>
            </div>
          </div>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <NavIcon name="logout" className="w-5 h-5 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
