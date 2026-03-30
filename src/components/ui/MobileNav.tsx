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
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-stretch border-t-2 border-slate-200 bg-white shadow-sm shadow-[0_-2px_8px_rgb(0,0,0,0.06)] md:hidden">
      {mobileItems.map((module) => {
        const isActive =
          pathname === module.href || pathname.startsWith(module.href + '/');
        return (
          <Link
            key={module.key}
            href={module.href}
            className={[
              'relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white',
            ].join(' ')}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-b-full bg-blue-600" />
            )}
            <NavIcon
              name={module.icon as Parameters<typeof NavIcon>[0]['name']}
              className={['w-5 h-5 transition-transform', isActive ? 'scale-110' : ''].join(' ')}
            />
            <span className="leading-none">{module.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
