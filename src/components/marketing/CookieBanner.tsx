'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = document.cookie
      .split('; ')
      .find((row) => row.startsWith('cookie_consent='));
    if (!consent) setVisible(true);
  }, []);

  function handleAccept() {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=true; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Bandeau cookies"
      className="fixed bottom-0 inset-x-0 z-50 p-4"
    >
      <div className="mx-auto max-w-3xl bg-[#1B2A4A] text-white rounded-2xl shadow-2xl
                      flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4">
        <p className="flex-1 text-sm text-slate-300 leading-relaxed">
          Ce site utilise uniquement des cookies essentiels au fonctionnement du service
          (session d&apos;authentification). Aucun cookie de tracking.{' '}
          <Link href="/confidentialite" className="text-[#60A5FA] underline underline-offset-2 hover:text-white transition-colors">
            En savoir plus
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors
                     px-5 py-2 text-sm font-semibold text-white whitespace-nowrap"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
