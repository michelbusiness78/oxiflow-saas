'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Tab { key: string; label: string; count?: number; }

interface Props { tabs: Tab[]; current: string; }

export function RhTabs({ tabs, current }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function select(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="border-b border-oxi-border">
      <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Onglets RH">
        {tabs.map((tab) => {
          const active = current === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => select(tab.key)}
              className={[
                'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'border-[#7C3AED] text-[#7C3AED]'
                  : 'border-transparent text-oxi-text-secondary hover:border-oxi-border hover:text-oxi-text',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 text-xs font-medium',
                    active ? 'bg-[#EDE9FE] text-[#7C3AED]' : 'bg-oxi-bg text-oxi-text-muted',
                  ].join(' ')}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
