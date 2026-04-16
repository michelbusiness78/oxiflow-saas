'use client';

// Modale de prévisualisation avant envoi d'un devis par email.
// Ouvre un formulaire pré-rempli (De / À / Objet / Message) que l'utilisateur
// peut modifier avant de confirmer l'envoi réel.

import { useState, useEffect } from 'react';
import type { QuoteWithClient } from './QuoteForm';
import { fmtEur, fmtDate } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendDevisModalProps {
  /** Le devis à envoyer — null = modale fermée */
  devis:     QuoteWithClient | null;
  clients:   { id: string; nom: string; email?: string | null }[];
  companies: { id: string; name: string; email?: string | null }[];
  onClose:   () => void;
  onSent:    (devisId: string, toEmail: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaultMessage(
  clientNom:    string,
  devisNumero:  string,
  montantTtc:   number,
  validite:     string | null,
  societeNom:   string,
): string {
  const ttcLine    = fmtEur(montantTtc);
  const validLine  = validite ? `\nCe devis est valable jusqu'au ${validite}.` : '';
  return (
    `Bonjour ${clientNom},\n\n` +
    `Veuillez trouver ci-joint votre devis ${devisNumero} d'un montant de ${ttcLine}.` +
    validLine +
    `\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,\n${societeNom}`
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function SendDevisModal({ devis, clients, companies, onClose, onSent }: SendDevisModalProps) {
  const open = !!devis;

  // Données dérivées
  const client  = devis ? clients.find((c) => c.id === (devis.client_id ?? '')) ?? null : null;
  const company = devis ? companies.find((c) => c.id === (devis.company_id ?? '')) ?? null : null;

  const defaultTo = client?.email ?? '';
  const defaultFrom = company?.email ?? '';
  const societeNom  = company?.name ?? 'OxiFlow';
  const clientNom   = client?.nom ?? '';
  const devisNumero = devis?.number ?? '';
  const montantTtc  = (devis?.montant_ttc as number) ?? 0;
  const validite    = devis?.validity ? fmtDate(devis.validity as string) : null;

  const defaultSubject = `Devis ${devisNumero} — ${societeNom}`;
  const defaultMessage = devis
    ? buildDefaultMessage(clientNom, devisNumero, montantTtc, validite, societeNom)
    : '';

  // ── État local ──
  const [to,      setTo]      = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  // Réinitialise les champs quand le devis change
  useEffect(() => {
    if (devis) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setError('');
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devis?.id]);

  // Fermeture sur Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!devis) return null;

  // ── Envoi ──
  async function handleSend() {
    if (!to.trim()) return;
    setSending(true);
    setError('');
    try {
      const res  = await fetch(`/api/quotes/${devis!.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de l\'envoi.');
        setSending(false);
        return;
      }
      onSent(devis!.id, to.trim());
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.');
      setSending(false);
    }
  }

  const canSend = to.trim().length > 0 && !sending;

  // ─── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panneau — centré sur desktop, slide-up sur mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Envoyer le devis par email"
        className={[
          'fixed z-50 bg-white shadow-2xl',
          // Mobile : slide depuis le bas, quasi plein écran
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[95vh]',
          // Desktop : fenêtre centrée
          'sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:right-auto',
          'sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:rounded-2xl sm:w-full sm:max-w-[560px] sm:max-h-[90vh]',
          'flex flex-col overflow-hidden',
        ].join(' ')}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Envoyer le devis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vérifiez et personnalisez l&apos;email avant l&apos;envoi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Champ De */}
          {defaultFrom && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                De
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500 cursor-not-allowed select-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <span>{defaultFrom}</span>
                <span className="ml-auto text-xs text-slate-400 italic">Non modifiable</span>
              </div>
            </div>
          )}

          {/* Champ À */}
          <div>
            <label htmlFor="send-modal-to" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              À <span className="text-red-500">*</span>
            </label>
            <input
              id="send-modal-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@destinataire.fr"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {!to.trim() && (
              <p className="mt-1 text-xs text-amber-600">
                Aucun email renseigné. Saisissez l&apos;adresse du destinataire.
              </p>
            )}
          </div>

          {/* Champ Objet */}
          <div>
            <label htmlFor="send-modal-subject" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Objet
            </label>
            <input
              id="send-modal-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Champ Message */}
          <div>
            <label htmlFor="send-modal-message" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Message
            </label>
            <textarea
              id="send-modal-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
            />
          </div>

          {/* Notice pièce jointe */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3.5 py-2.5">
            <span className="text-base" aria-hidden>📎</span>
            <p className="text-xs text-blue-700">
              Le PDF du devis sera automatiquement joint à cet email.
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Pied — boutons */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Envoi en cours…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
