'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { NavIcon } from './NavIcon';
import { UserMenu } from '@/components/auth/UserMenu';
import { VoiceAgent } from '@/components/voice/VoiceAgent';
import { usePathname } from 'next/navigation';
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

interface DashboardShellProps {
  children:      React.ReactNode;
  userName:      string;
  userEmail:     string;
  userRole:      string;
  allowedHrefs?: string[];
}

export function DashboardShell({ children, userName, userEmail, userRole, allowedHrefs }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full bg-oxi-bg">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        allowedHrefs={allowedHrefs}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b border-oxi-border bg-oxi-surface px-4 md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-oxi-text-secondary hover:bg-oxi-bg hover:text-oxi-text transition-colors md:hidden"
            aria-label="Ouvrir le menu"
          >
            <NavIcon name="menu" className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <Breadcrumb />
          </div>

          <UserMenu name={userName} email={userEmail} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="mx-auto w-full max-w-screen-xl">
            {children}
          </div>
        </main>
      </div>

      <VoiceAgent userName={userName} userRole={userRole} />
      <MobileNav allowedHrefs={allowedHrefs} />
    </div>
  );
}
