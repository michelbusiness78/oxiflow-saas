'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navModules } from '@/lib/theme';
import { NavIcon } from './NavIcon';

interface MobileNavProps {
  allowedHrefs?: string[];
}

export function MobileNav({ allowedHrefs }: MobileNavProps) {
  const pathname = usePathname();
  const mobileItems = (
    allowedHrefs ? navModules.filter((m) => allowedHrefs.includes(m.href)) : navModules
  ).slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-stretch border-t border-oxi-border bg-oxi-surface md:hidden">
      {mobileItems.map((module) => {
        const isActive =
          pathname === module.href || pathname.startsWith(module.href + '/');
        return (
          <Link
            key={module.key}
            href={module.href}
            className={[
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive
                ? 'text-oxi-primary'
                : 'text-oxi-text-secondary hover:text-oxi-text',
            ].join(' ')}
          >
            <NavIcon
              name={module.icon as Parameters<typeof NavIcon>[0]['name']}
              className={['w-5 h-5 transition-transform', isActive ? 'scale-110' : ''].join(' ')}
            />
            <span className="leading-none">{module.label}</span>
            {isActive && (
              <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-oxi-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
