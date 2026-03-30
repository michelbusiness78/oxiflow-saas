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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <p className="text-sm font-semibold text-slate-800">Signature client</p>
        <p className="text-xs text-slate-400">Signez dans le cadre ci-dessous</p>
      </div>

      {/* Canvas */}
      <div className="relative bg-white mx-4 my-3 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden">
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
            <p className="text-slate-400 text-sm">Signez ici…</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isEmpty}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 hover:bg-white transition-colors disabled:opacity-40"
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty || saving}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Valider'}
        </button>
      </div>
    </div>
  );
}
