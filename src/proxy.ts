import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ─── Routes toujours accessibles (connecté ou non, jamais redirigé) ──────────

const ALWAYS_PUBLIC = ['/', '/cgv', '/mentions-legales', '/confidentialite'];

// ─── Pages d'authentification (redirige vers /pilotage si déjà connecté) ─────

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/setup-password'];

// ─── Accès par rôle ───────────────────────────────────────────────────────────

const ROLE_MODULES: Record<string, string[]> = {
  dirigeant:   ['/pilotage', '/commerce', '/projets', '/technicien', '/chef-projet', '/rh'],
  commercial:  ['/pilotage', '/commerce'],
  technicien:  ['/technicien'],
  chef_projet: ['/pilotage', '/projets', '/chef-projet'],
  rh:          ['/pilotage', '/rh'],
};

// Module par défaut si accès refusé
const ROLE_DEFAULT: Record<string, string> = {
  dirigeant:   '/pilotage',
  commercial:  '/commerce',
  technicien:  '/technicien',
  chef_projet: '/projets',
  rh:          '/pilotage',
};

// Tous les modules dashboard (pour détecter si la route est un module)
const ALL_MODULES = ['/pilotage', '/commerce', '/projets', '/technicien', '/chef-projet', '/rh'];

function isDashboardModule(pathname: string) {
  return ALL_MODULES.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

function isAllowed(role: string, pathname: string): boolean {
  if (role === 'dirigeant') return true;  // dirigeant = accès total
  const allowed = ROLE_MODULES[role] ?? [];
  return allowed.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

// ─── Middleware / Proxy function ──────────────────────────────────────────────
// Nommé "middleware" pour compatibilité Next.js + exporté aussi comme "proxy"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabaseResponse, user } = await updateSession(request);

  const isAlwaysPublic = ALWAYS_PUBLIC.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  const isAuthPath = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  // Landing & pages légales → accessibles à tous, aucune redirection
  if (isAlwaysPublic) {
    supabaseResponse.headers.set('x-pathname', pathname);
    return supabaseResponse;
  }

  // Déjà connecté sur une page d'auth → redirige vers le dashboard
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/pilotage';
    url.search   = '';
    return NextResponse.redirect(url);
  }

  // Pas connecté sur une route protégée → redirige vers /login
  if (!user && !isAuthPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Vérification du rôle pour les modules dashboard
  if (user && isDashboardModule(pathname)) {
    // Récupère le rôle depuis la DB (même client auth que updateSession)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},  // lecture seule ici — les cookies sont gérés par updateSession
        },
      },
    );

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'dirigeant';  // fallback = accès total si profil manquant

    if (!isAllowed(role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_DEFAULT[role] ?? '/pilotage';
      url.search   = '';
      return NextResponse.redirect(url);
    }
  }

  // Injecte le pathname courant en header pour les Server Components/layouts
  // (utilisé par le layout dashboard pour éviter les boucles de redirection)
  supabaseResponse.headers.set('x-pathname', pathname);
  return supabaseResponse;
}

// Alias pour rétro-compatibilité si importé ailleurs
export { middleware as proxy };

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
