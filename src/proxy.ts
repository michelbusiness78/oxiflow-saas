import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ─── Routes publiques (pas d'auth requise) ────────────────────────────────────

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

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

// ─── Proxy function ───────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabaseResponse, user } = await updateSession(request);

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  // Pas connecté → redirige vers /login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Déjà connecté → redirige hors des pages auth
  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/pilotage';
    url.search   = '';
    return NextResponse.redirect(url);
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
