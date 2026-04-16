import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { OxiLogo } from '@/components/OxiLogo';

export async function MarketingHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <OxiLogo variant="oxiflow" theme="light" size="md" />
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
          <a href="/#fonctionnalites" className="text-sm text-slate-600 hover:text-[#2563EB] transition-colors">
            Fonctionnalités
          </a>
          <a href="/#tarifs" className="text-sm text-slate-600 hover:text-[#2563EB] transition-colors">
            Tarifs
          </a>
          <a href="/#faq" className="text-sm text-slate-600 hover:text-[#2563EB] transition-colors">
            FAQ
          </a>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn ? (
            <Link
              href="/pilotage"
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors shadow-sm"
            >
              Accéder à mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium text-slate-700 hover:text-[#2563EB] transition-colors px-2"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors shadow-sm"
              >
                Essai gratuit
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
