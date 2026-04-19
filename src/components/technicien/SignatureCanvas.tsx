'use client';

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignatureCanvasHandle {
  clear:      () => void;
  getDataURL: () => string | null;
  isEmpty:    () => boolean;
}

interface Props {
  readonly?:     boolean;
  existingData?: string | null;
  onBegin?:      () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCanvasPos(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// Compare toDataURL avec un canvas vierge de même taille.
// Plus fiable que getImageData sur iOS Safari (évite les problèmes de sync GPU).
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const blank = document.createElement('canvas');
    blank.width  = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL('image/png') === blank.toDataURL('image/png');
  } catch {
    return false; // en cas d'erreur, on ne bloque pas la validation
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, Props>(
  function SignatureCanvas({ readonly = false, existingData, onBegin }, ref) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const isDrawing  = useRef(false);
    const hasDrawn   = useRef(false);
    // Ref stable pour onBegin — évite de recréer startDraw à chaque render parent
    const onBeginRef = useRef(onBegin);
    useEffect(() => { onBeginRef.current = onBegin; }, [onBegin]);

    // Charger une signature existante
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !existingData) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img  = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        hasDrawn.current = true;
      };
      img.src = existingData;
    }, [existingData]);

    const startDraw = useCallback((x: number, y: number) => {
      if (readonly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!hasDrawn.current) onBeginRef.current?.();
      isDrawing.current = true;
      // Dessine un point au démarrage pour les traits très courts (tap mobile)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      hasDrawn.current = true;
    }, [readonly]);

    const draw = useCallback((x: number, y: number) => {
      if (!isDrawing.current || readonly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
      hasDrawn.current = true;
    }, [readonly]);

    const endDraw = useCallback(() => { isDrawing.current = false; }, []);

    // Attacher les listeners de façon impérative (touch passive:false obligatoire)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onMouseDown = (e: MouseEvent) => { const p = getCanvasPos(canvas, e.clientX, e.clientY); startDraw(p.x, p.y); };
      const onMouseMove = (e: MouseEvent) => { const p = getCanvasPos(canvas, e.clientX, e.clientY); draw(p.x, p.y); };
      const onMouseUp   = () => endDraw();

      const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; const p = getCanvasPos(canvas, t.clientX, t.clientY); startDraw(p.x, p.y); };
      const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; const p = getCanvasPos(canvas, t.clientX, t.clientY); draw(p.x, p.y); };
      const onTouchEnd   = (e: TouchEvent) => { e.preventDefault(); endDraw(); };

      canvas.addEventListener('mousedown',  onMouseDown);
      canvas.addEventListener('mousemove',  onMouseMove);
      canvas.addEventListener('mouseup',    onMouseUp);
      canvas.addEventListener('mouseleave', onMouseUp);
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
      canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

      return () => {
        canvas.removeEventListener('mousedown',  onMouseDown);
        canvas.removeEventListener('mousemove',  onMouseMove);
        canvas.removeEventListener('mouseup',    onMouseUp);
        canvas.removeEventListener('mouseleave', onMouseUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove',  onTouchMove);
        canvas.removeEventListener('touchend',   onTouchEnd);
      };
    }, [startDraw, draw, endDraw]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn.current = false;
      },
      getDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        // Retourne null seulement si LES DEUX checks s'accordent sur "vide" :
        // hasDrawn.current peut manquer sur mobile ; isCanvasBlank lit les pixels réels.
        if (!hasDrawn.current && isCanvasBlank(canvas)) return null;
        return canvas.toDataURL('image/png');
      },
      isEmpty: () => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        return !hasDrawn.current && isCanvasBlank(canvas);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className={`w-full rounded-[10px] border-2 ${
          readonly
            ? 'border-green-500 cursor-default'
            : 'border-dashed border-[#c2cbe0] cursor-crosshair'
        }`}
        style={{ background: '#f5f7fc', touchAction: 'none', height: '160px' }}
      />
    );
  },
);
