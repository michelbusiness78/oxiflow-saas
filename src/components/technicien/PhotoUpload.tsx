'use client';

import { useRef } from 'react';

export interface PhotoEntry {
  id:           string;
  previewUrl:   string;   // object URL for preview
  file?:        Blob;     // compressed blob (null if already uploaded)
  uploadedUrl?: string;   // URL after upload
  storagePath?: string;   // Storage path for deletion
}

interface PhotoUploadProps {
  photos:         PhotoEntry[];
  onChange:       (photos: PhotoEntry[]) => void;
  onPhotoClick?:  (url: string) => void;
  disabled?:      boolean;
}

// ─── Compression ─────────────────────────────────────────────────────────────

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_WIDTH = 1200;
      const scale     = Math.min(1, MAX_WIDTH / img.width);
      const canvas    = document.createElement('canvas');
      canvas.width    = Math.round(img.width  * scale);
      canvas.height   = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objUrl);
          if (blob) resolve(blob);
          else reject(new Error('compression failed'));
        },
        'image/jpeg',
        0.8,
      );
    };
    img.onerror = () => reject(new Error('load'));
    img.src = objUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhotoUpload({ photos, onChange, onPhotoClick, disabled }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newEntries: PhotoEntry[] = await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        return {
          id:         crypto.randomUUID(),
          previewUrl,
          file:       compressed,
        };
      }),
    );

    onChange([...photos, ...newEntries]);
    // Reset input so same file can be re-added
    e.target.value = '';
  }

  function remove(id: string) {
    const entry = photos.find((p) => p.id === id);
    if (entry?.previewUrl && !entry.uploadedUrl) URL.revokeObjectURL(entry.previewUrl);
    onChange(photos.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Grille de previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt="Photo intervention"
                className={`h-full w-full object-cover ${onPhotoClick ? 'cursor-zoom-in' : ''}`}
                onClick={() => onPhotoClick?.(p.uploadedUrl ?? p.previewUrl)}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  aria-label="Supprimer la photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {p.uploadedUrl && (
                <div className="absolute bottom-1 right-1 rounded-full bg-green-500 p-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3 text-white" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bouton d'ajout */}
      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm font-semibold text-slate-500 hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            Ajouter des photos ({photos.length})
          </button>
        </>
      )}
    </div>
  );
}
