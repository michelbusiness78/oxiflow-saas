import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="bg-[#1B2A4A] text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] text-white" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight">OxiFlow</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">
              La gestion PME intelligente, pilotée à la voix.
            </p>
          </div>

          {/* Produit */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4 text-slate-400">Produit</p>
            <ul className="space-y-2.5">
              <li><a href="/#fonctionnalites" className="text-sm text-slate-400 hover:text-white transition-colors">Fonctionnalités</a></li>
              <li><a href="/#tarifs" className="text-sm text-slate-400 hover:text-white transition-colors">Tarifs</a></li>
              <li><a href="/#faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/register" className="text-sm text-slate-400 hover:text-white transition-colors">Essai gratuit</Link></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4 text-slate-400">Légal</p>
            <ul className="space-y-2.5">
              <li><Link href="/cgv" className="text-sm text-slate-400 hover:text-white transition-colors">CGV</Link></li>
              <li><Link href="/confidentialite" className="text-sm text-slate-400 hover:text-white transition-colors">Confidentialité</Link></li>
              <li>
                <Link href="/mentions-legales" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>

          {/* Réseaux */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4 text-slate-400">Suivez-nous</p>
            <div className="flex gap-3 mb-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="LinkedIn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Twitter / X"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
            <a
              href="mailto:contact@oxilabs.fr"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              contact@oxilabs.fr
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p className="text-xs text-slate-500">© 2026 OxiFlow. Tous droits réservés.</p>
            <p className="text-xs text-slate-500">
              Édité par{' '}
              <a
                href="https://oxilabs.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition-colors"
              >
                Oxilabs
              </a>
            </p>
          </div>
          <p className="text-xs text-slate-500">Conçu et hébergé en France 🇫🇷</p>
        </div>
      </div>
    </footer>
  );
}
