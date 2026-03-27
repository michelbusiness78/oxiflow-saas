'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui/Sidebar';
import { MobileNav } from '@/components/ui/MobileNav';
import { NavIcon } from '@/components/ui/NavIcon';
import { navModules } from '@/lib/theme';

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const getLabel = (segment: string) => {
    const module = navModules.find((m) => m.href === '/' + segment);
    return module?.label ?? segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex items-center gap-1.5 text-sm">
        <li>
          <span className="font-medium text-oxi-text">
            {segments.length === 0 ? 'Accueil' : getLabel(segments[0])}
          </span>
        </li>
        {segments.slice(1).map((seg, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <NavIcon name="chevron-right" className="w-3.5 h-3.5 text-oxi-text-muted" />
            <span className="text-oxi-text-secondary">{getLabel(seg)}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full bg-oxi-bg">
      {/* Sidebar desktop + drawer mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Zone principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-oxi-border bg-oxi-surface px-4 md:px-6">
          {/* Bouton menu hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-oxi-text-secondary hover:bg-oxi-bg hover:text-oxi-text transition-colors md:hidden"
            aria-label="Ouvrir le menu"
          >
            <NavIcon name="menu" className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1">
            <Breadcrumb />
          </div>

          {/* Actions header */}
          <div className="flex items-center gap-3">
            {/* Nom utilisateur */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-oxi-primary/10 text-sm font-semibold text-oxi-primary">
                M
              </div>
              <span className="text-sm font-medium text-oxi-text">Michel</span>
            </div>

            {/* Bouton déconnexion */}
            <button className="flex items-center gap-1.5 rounded-lg border border-oxi-border px-3 py-1.5 text-sm text-oxi-text-secondary hover:border-oxi-danger/40 hover:bg-oxi-danger-light hover:text-oxi-danger transition-colors">
              <NavIcon name="logout" className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-screen-xl">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <MobileNav />
    </div>
  );
}
