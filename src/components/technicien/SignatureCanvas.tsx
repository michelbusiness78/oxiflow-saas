'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface SignatureCanvasProps {
  onSave:   (blob: Blob) => void;
  onCancel: () => void;
  saving?:  boolean;
}

export function SignatureCanvas({ onSave, onCancel, saving }: SignatureCanvasProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty,  setIsEmpty]  = useState(true);

  // Initialiser le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const pos    = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  }

  function stopDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }, []);

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  }

  return (
    <div className="rounded-2xl border border-oxi-border bg-oxi-surface overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-oxi-border bg-oxi-bg">
        <p className="text-sm font-semibold text-oxi-text">Signature client</p>
        <p className="text-xs text-oxi-text-muted">Signez dans le cadre ci-dessous</p>
      </div>

      {/* Canvas */}
      <div className="relative bg-white mx-4 my-3 rounded-xl border-2 border-dashed border-oxi-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-oxi-text-muted text-sm">Signez ici…</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-oxi-border py-3 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isEmpty}
          className="flex-1 rounded-xl border border-oxi-border py-3 text-sm font-medium text-oxi-text-secondary hover:bg-oxi-bg transition-colors disabled:opacity-40"
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty || saving}
          className="flex-1 rounded-xl bg-oxi-primary py-3 text-sm font-semibold text-white hover:bg-oxi-primary-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Valider'}
        </button>
      </div>
    </div>
  );
}
