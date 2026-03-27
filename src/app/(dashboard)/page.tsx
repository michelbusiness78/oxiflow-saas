import { navModules } from '@/lib/theme';
import { NavIcon } from '@/components/ui/NavIcon';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-xl border border-oxi-border bg-oxi-surface p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-oxi-primary/10">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-oxi-primary">
              <span className="text-sm font-bold text-white">O</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-oxi-text">
              Bienvenue sur OxiFlow
            </h1>
            <p className="mt-1 text-oxi-text-secondary">
              Votre plateforme de gestion PME avec agent vocal IA. Sélectionnez un module pour commencer.
            </p>
          </div>
        </div>
      </div>

      {/* Grille modules */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-oxi-text-muted">
          Modules disponibles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navModules.map((module, index) => (
            <a
              key={module.key}
              href={module.href}
              className="group flex items-center gap-4 rounded-xl border border-oxi-border bg-oxi-surface p-5 transition-all hover:border-oxi-primary/30 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-oxi-bg text-oxi-text-secondary transition-colors group-hover:bg-oxi-primary/10 group-hover:text-oxi-primary">
                <NavIcon
                  name={module.icon as Parameters<typeof NavIcon>[0]['name']}
                  className="w-5 h-5"
                />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-oxi-text group-hover:text-oxi-primary transition-colors">
                  {module.label}
                </p>
                <p className="mt-0.5 text-xs text-oxi-text-muted">
                  {getModuleDescription(module.key)}
                </p>
              </div>
              <NavIcon
                name="chevron-right"
                className="ml-auto w-4 h-4 shrink-0 text-oxi-text-muted opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5"
              />
            </a>
          ))}
        </div>
      </div>

      {/* Bandeau agent IA */}
      <div className="rounded-xl border border-oxi-primary/20 bg-oxi-primary-light p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-oxi-primary text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-5 h-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-oxi-navy">Agent vocal IA</p>
            <p className="text-sm text-oxi-text-secondary">
              Parlez à votre assistant pour piloter votre activité à la voix.
            </p>
          </div>
          <button className="ml-auto shrink-0 rounded-lg bg-oxi-primary px-4 py-2 text-sm font-medium text-white hover:bg-oxi-primary-hover transition-colors">
            Activer
          </button>
        </div>
      </div>
    </div>
  );
}

function getModuleDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'pilotage':    'Tableaux de bord, KPIs et rapports',
    'commerce':    'Devis, factures et suivi clients',
    'projets':     'Gestion de projets et tâches',
    'technicien':  'Interventions et maintenance',
    'chef-projet': 'Planification et ressources',
    'rh':          'Équipes, congés et paie',
  };
  return descriptions[key] ?? '';
}
