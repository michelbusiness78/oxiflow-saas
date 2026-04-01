'use client';

import { useEffect } from 'react';

interface SlideOverProps {
  open:     boolean;
  onClose:  () => void;
  title:    string;
  children: React.ReactNode;
  width?:   'md' | 'lg' | 'xl'; // conservé pour compatibilité API
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      aria-label="Fermer"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  // Fermer avec Échap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquer le scroll du body (mobile uniquement — desktop scroll géré dans le panel)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    /*
     * Mobile  : couvre tout l'écran (inset-0, z-50)
     * Desktop : démarre après la sidebar (left-[230px]) et après la topbar (top-14)
     *           → sidebar + topbar restent visibles et utilisables
     */
    <div
      className="fixed inset-0 z-50 md:left-[230px] md:top-14 md:z-40"
      aria-modal="true"
      role="dialog"
    >

      {/* ── Mobile : overlay sombre + bottom-sheet ──────────────────────────── */}
      <div className="md:hidden h-full">
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Feuille qui remonte du bas */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col bg-white rounded-t-[20px] max-h-[95vh] shadow-xl animate-in slide-in-from-bottom duration-300">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <CloseBtn onClick={onClose} />
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>

      {/* ── Desktop : remplace la zone de contenu, sidebar + topbar intactes ── */}
      <div className="hidden md:flex h-full flex-col bg-[#f0f3f9] overflow-y-auto animate-in fade-in duration-200">
        {/* Header sticky */}
        <div className="sticky top-0 z-10 shrink-0 bg-[#f0f3f9] border-b border-slate-200/80">
          <div className="max-w-[900px] mx-auto flex h-16 items-center justify-between px-6">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <CloseBtn onClick={onClose} />
          </div>
        </div>
        {/* Contenu */}
        <div className="flex-1 max-w-[900px] mx-auto w-full py-6 px-6">
          {children}
        </div>
      </div>

    </div>
  );
}
