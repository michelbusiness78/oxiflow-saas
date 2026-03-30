'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface TabItem {
  key:   string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs:    TabItem[];
  current: string;
  param?:  string; // searchParam name, default "tab"
}

export function Tabs({ tabs, current, param = 'tab' }: TabsProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  function select(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set(param, key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Onglets">
        {tabs.map((tab) => {
          const active = current === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => select(tab.key)}
              className={[
                'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 text-xs font-medium',
                    active ? 'bg-blue-600/10 text-blue-600' : 'bg-white text-slate-400',
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
