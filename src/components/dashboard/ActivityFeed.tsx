import Link from 'next/link';
import type { ActivityItem } from '@/lib/dashboard-data';

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `il y a ${days}j`;
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const typeConfig: Record<ActivityItem['type'], { color: string; dot: string }> = {
  devis:         { color: 'text-blue-600',  dot: 'bg-blue-600' },
  facture:       { color: 'text-oxi-success',  dot: 'bg-green-500' },
  intervention:  { color: 'text-oxi-warning',  dot: 'bg-oxi-warning' },
  sav:           { color: 'text-oxi-danger',   dot: 'bg-oxi-danger' },
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-slate-400" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">Aucune activité récente</p>
        <p className="mt-1 text-xs text-slate-400">
          Les actions apparaîtront ici au fur et à mesure.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/commerce"
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Créer un devis
          </Link>
          <Link
            href="/clients"
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-white transition-colors"
          >
            Ajouter un client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {items.map((item) => {
        const cfg = typeConfig[item.type];
        return (
          <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {/* Dot indicateur */}
            <div className="mt-1.5 flex shrink-0 items-center">
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            </div>

            {/* Contenu */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800 leading-snug">{item.description}</p>
            </div>

            {/* Temps relatif */}
            <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
              {relativeTime(item.timestamp)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
