'use client';

import { useEffect, useRef } from 'react';

interface SlideOverProps {
  open:       boolean;
  onClose:    () => void;
  title:      string;
  children:   React.ReactNode;
  width?:     'md' | 'lg' | 'xl';
}

const widths = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

export function SlideOver({ open, onClose, title, children, width = 'lg' }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Fermer avec Echap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" aria-modal="true" role="dialog">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panneau */}
      <div
        ref={panelRef}
        className={[
          'relative flex h-full w-full flex-col bg-oxi-surface shadow-oxi-xl',
          'animate-in slide-in-from-right duration-300',
          widths[width],
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-oxi-border px-5">
          <h2 className="text-base font-semibold text-oxi-text">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-oxi-text-muted hover:bg-oxi-bg hover:text-oxi-text transition-colors"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
