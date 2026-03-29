import { type NextRequest } from 'next/server';
import { proxy } from './proxy';

export function middleware(request: NextRequest) {
  return proxy(request);
}

// Même matcher que dans proxy.ts — exclut les assets statiques
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
