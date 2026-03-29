import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export async function MarketingHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] text-white" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-base font-bold text-[#1B2A4A] tracking-tight">OxiFlow</span>
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
