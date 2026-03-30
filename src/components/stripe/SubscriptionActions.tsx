'use client';

import { useState } from 'react';

// ─── Bouton Checkout ──────────────────────────────────────────────────────────

interface CheckoutButtonProps {
  priceId:   string;
  label:     string;
  variant?:  'primary' | 'outline';
}

export function CheckoutButton({ priceId, label, variant = 'outline' }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ priceId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      if (data.url)   window.location.href = data.url;
    } catch {
      setError('Erreur réseau, réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={[
          'w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60',
          variant === 'primary'
            ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-md shadow-blue-100'
            : 'border border-slate-200 text-[#1B2A4A] hover:bg-slate-50',
        ].join(' ')}
      >
        {loading ? 'Redirection…' : label}
      </button>
    </div>
  );
}

// ─── Bouton Portal ────────────────────────────────────────────────────────────

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handlePortal() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      if (data.url)   window.location.href = data.url;
    } catch {
      setError('Erreur réseau, réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={handlePortal}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-[#1B2A4A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#243660] transition-colors disabled:opacity-60"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-4 w-4" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
        {loading ? 'Redirection…' : 'Gérer mon abonnement'}
      </button>
    </div>
  );
}
