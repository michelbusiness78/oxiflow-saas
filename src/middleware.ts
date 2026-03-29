import { type NextRequest, NextResponse } from 'next/server';

/**
 * Middleware minimal : injecte le pathname courant dans un header HTTP
 * pour qu'il soit lisible dans les Server Components et layouts via headers().
 * Nécessaire pour éviter les boucles de redirection dans le layout dashboard.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    // Toutes les routes sauf les fichiers statiques et l'API Next.js interne
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
