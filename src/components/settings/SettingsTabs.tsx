'use client';

import { useState } from 'react';

type Tab = 'societe' | 'utilisateurs' | 'abonnement';

interface Props {
  societe:      React.ReactNode;
  utilisateurs: React.ReactNode;
  abonnement:   React.ReactNode;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'societe',      label: 'Ma société'   },
  { key: 'utilisateurs', label: 'Utilisateurs' },
  { key: 'abonnement',   label: 'Abonnement'   },
];

export function SettingsTabs({ societe, utilisateurs, abonnement }: Props) {
  const [tab, setTab] = useState<Tab>('societe');

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-oxi-border overflow-x-auto">
        <nav className="flex gap-0 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-oxi-primary text-oxi-primary'
                  : 'border-transparent text-oxi-text-secondary hover:text-oxi-text hover:border-oxi-border',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-oxi-border bg-oxi-surface p-6">
        {tab === 'societe'      && societe}
        {tab === 'utilisateurs' && utilisateurs}
        {tab === 'abonnement'   && abonnement}
      </div>
    </div>
  );
}
