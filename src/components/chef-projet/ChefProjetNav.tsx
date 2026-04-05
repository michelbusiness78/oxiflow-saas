'use client';

export const CHEF_TABS = [
  { key: 'dashboard',   icon: '📊', label: 'Tableau de bord', short: 'Dashboard' },
  { key: 'planning',    icon: '📅', label: 'Planning',        short: 'Planning'  },
  { key: 'projets',     icon: '🔨', label: 'Projets',         short: 'Projets'   },
  { key: 'sav',         icon: '🔧', label: 'SAV / Tickets',   short: 'SAV'       },
  { key: 'techniciens', icon: '👷', label: 'Techniciens',     short: 'Équipe'    },
] as const;

export type ChefTab = (typeof CHEF_TABS)[number]['key'];

interface Props {
  activeTab: string;
  notifCount?: number;
}

export function ChefProjetNav({ activeTab, notifCount = 0 }: Props) {
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 gap-1">
        {CHEF_TABS.map(({ key, icon, label }) => (
          <a
            key={key}
            href={`/chef-projet?tab=${key}`}
            className={[
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="flex-1">{label}</span>
            {key === 'projets' && notifCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {notifCount}
              </span>
            )}
          </a>
        ))}
      </aside>

      {/* ── Mobile bottom nav (fixed) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm safe-area-pb">
        <div className="flex items-stretch">
          {CHEF_TABS.map(({ key, icon, short }) => (
            <a
              key={key}
              href={`/chef-projet?tab=${key}`}
              className={[
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                activeTab === key ? 'text-blue-600' : 'text-slate-500',
              ].join(' ')}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{short}</span>
              {key === 'projets' && notifCount > 0 && (
                <span className="absolute right-3 top-1 rounded-full bg-red-500 h-2 w-2" />
              )}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
