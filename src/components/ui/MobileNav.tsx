'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navModules } from '@/lib/theme';
import LordIcon from './LordIcon';
import { NavIcon } from './NavIcon';

// Mapping from navModule icon name → Lordicon CDN URL
// 'users' (RH) omitted — falls back to NavIcon (CDN URL unreliable)
const LORDICON_MAP: Record<string, string> = {
  chart:     'https://cdn.lordicon.com/wmwqvixz.json',
  briefcase: 'https://cdn.lordicon.com/qhgmphtg.json',
  clipboard: 'https://cdn.lordicon.com/wloilxuq.json',
  wrench:    'https://cdn.lordicon.com/dxjqoygy.json',
};

interface MobileNavProps {
  allowedHrefs?: string[];
}

export function MobileNav({ allowedHrefs }: MobileNavProps) {
  const pathname = usePathname();
  const mobileItems = (
    allowedHrefs ? navModules.filter((m) => allowedHrefs.includes(m.href)) : navModules
  ).slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch border-t border-slate-200 bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {mobileItems.map((module) => {
        const isActive =
          pathname === module.href || pathname.startsWith(module.href + '/');
        return (
          <Link
            key={module.key}
            href={module.href}
            className={[
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors',
              isActive ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-blue-500" />
            )}
            {LORDICON_MAP[module.icon] ? (
              <LordIcon
                icon={LORDICON_MAP[module.icon]}
                size={20}
                trigger="click"
                colors={isActive ? 'primary:#2563EB' : 'primary:#6B7280'}
                className="shrink-0"
              />
            ) : (
              <NavIcon
                name={module.icon as Parameters<typeof NavIcon>[0]['name']}
                className="w-5 h-5 shrink-0"
              />
            )}
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
              {module.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
