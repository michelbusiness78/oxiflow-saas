'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoUpload, type PhotoEntry } from './PhotoUpload';
import { SignatureCanvas } from './SignatureCanvas';
import { RapportPDF } from './RapportPDF';
import {
  createInterventionAction,
  updateInterventionAction,
  terminerInterventionAction,
  uploadInterventionFileAction,
  type ChecklistItem,
  type MaterielItem,
} from '@/app/actions/interventions';

interface Client   { id: string; nom: string; adresse?: string; cp?: string; ville?: string; }
interface Catalogue { id: string; ref: string; designation: string; }

export interface Intervention {
  id:              string;
  client_id:       string;
  projet_id:       string | null;
  technicien_id:   string | null;
  date:            string;
  type:            'installation' | 'maintenance' | 'sav' | 'depannage';
  statut:          'planifiee' | 'en_cours' | 'terminee' | 'annulee';
  duree_minutes:   number | null;
  notes:           string | null;
  adresse:         string | null;
  photos:          string[];
  checklist:       ChecklistItem[];
  materiel:        MaterielItem[];
  signature_url:   string | null;
  created_at:      string;
  client_nom?:     string;
  technicien_nom?: string;
}

interface InterventionFormProps {
  open:        boolean;
  onClose:     () => void;
  clients:     Client[];
  catalogue:   Catalogue[];
  editing?:    Intervention | null;
  currentUserId: string;
}

const TYPE_ITEMS: { value: Intervention['type']; label: string; color: string }[] = [
  { value: 'installation', label: 'Installation', color: 'text-oxi-primary border-oxi-primary bg-oxi-primary-light'  },
  { value: 'maintenance',  label: 'Maintenance',  color: 'text-oxi-success border-oxi-success bg-oxi-success-light' },
  { value: 'sav',          label: 'SAV',           color: 'text-oxi-warning border-oxi-warning bg-oxi-warning-light' },
  { value: 'depannage',    label: 'Dépannage',    color: 'text-oxi-danger border-oxi-danger bg-oxi-danger-light'   },
];

// ─── Timer ────────────────────────────────────────────────────────────────────

function useTimer(initialSeconds = 0) {
  const [elapsed,  setElapsed]  = useState(initialSeconds);
  const [running,  setRunning]  = useState(false);
  const startRef   = useRef<number | null>(null);
  const baseRef    = useRef(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (running) return;
    startRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(baseRef.current + Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
  }, [running]);

  const pause = useCallback(() => {
    if (!running) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    baseRef.current = elapsed;
    startRef.current = null;
    setRunning(false);
  }, [running, elapsed]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsed(0);
    setRunning(false);
    baseRef.current = 0;
    startRef.current = null;
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const display = [
    Math.floor(elapsed / 3600).toString().padStart(2, '0'),
    Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0'),
    (elapsed % 60).toString().padStart(2, '0'),
  ].join(':');

  return { elapsed, running, start, pause, reset, display, minutes: Math.ceil(elapsed / 60) };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-oxi-text-muted">{title}</h3>
      {children}
    </div>
  );
}

const fieldCls = 'w-full rounded-xl border border-oxi-border bg-oxi-bg px-4 py-3 text-base text-oxi-text outline-none transition-colors focus:border-oxi-primary focus:ring-2 focus:ring-oxi-primary/20';

// ─── Main form ────────────────────────────────────────────────────────────────

export function InterventionForm({ open, onClose, clients, catalogue, editing, currentUserId }: InterventionFormProps) {
  const today = new Date().toISOString().slice(0, 16);

  // ── Champs de base ─────────────────────────────────────────────────────────
  const [clientId,   setClientId]   = useState(editing?.client_id  ?? '');
  const [type,       setType]       = useState<Intervention['type']>(editing?.type ?? 'maintenance');
  const [date,       setDate]       = useState(editing?.date ? editing.date.slice(0, 16) : today);
  const [adresse,    setAdresse]    = useState(editing?.adresse     ?? '');
  const [notes,      setNotes]      = useState(editing?.notes       ?? '');

  // ── Checklist ──────────────────────────────────────────────────────────────
  const [checklist,  setChecklist]  = useState<ChecklistItem[]>(editing?.checklist ?? []);
  const [newItem,    setNewItem]    = useState('');

  // ── Matériel ───────────────────────────────────────────────────────────────
  const [materiel,   setMateriel]   = useState<MaterielItem[]>(editing?.materiel ?? []);

  // ── Photos ─────────────────────────────────────────────────────────────────
  const [photos,     setPhotos]     = useState<PhotoEntry[]>(
    (editing?.photos ?? []).map((url) => ({ id: crypto.randomUUID(), previewUrl: url, uploadedUrl: url })),
  );

  // ── Signature ──────────────────────────────────────────────────────────────
  const [showSig,    setShowSig]    = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(editing?.signature_url ?? null);
  const [savingSig,  setSavingSig]  = useState(false);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const timer = useTimer((editing?.duree_minutes ?? 0) * 60);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [terminating, setTerminating] = useState(false);

  const isTerminee = editing?.statut === 'terminee';

  // Auto-fill adresse from client
  useEffect(() => {
    if (!clientId || adresse) return;
    const client = clients.find((c) => c.id === clientId);
    if (client?.adresse) {
      setAdresse([client.adresse, client.cp, client.ville].filter(Boolean).join(' '));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!open) return null;

  // ── Checklist helpers ──────────────────────────────────────────────────────

  function addChecklistItem() {
    if (!newItem.trim()) return;
    setChecklist((p) => [...p, { id: crypto.randomUUID(), label: newItem.trim(), done: false }]);
    setNewItem('');
  }

  function toggleChecklistItem(id: string) {
    setChecklist((p) => p.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  }

  function removeChecklistItem(id: string) {
    setChecklist((p) => p.filter((item) => item.id !== id));
  }

  // ── Matériel helpers ───────────────────────────────────────────────────────

  function addMateriel() {
    setMateriel((p) => [...p, { id: crypto.randomUUID(), designation: '', quantite: 1, reference: null }]);
  }

  function updateMateriel(id: string, key: keyof MaterielItem, value: string | number) {
    setMateriel((p) => p.map((m) => m.id === id ? { ...m, [key]: value } : m));
  }

  function removeMateriel(id: string) {
    setMateriel((p) => p.filter((m) => m.id !== id));
  }

  // ── Upload photos ──────────────────────────────────────────────────────────

  async function uploadPendingPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const photo of photos) {
      if (photo.uploadedUrl) { urls.push(photo.uploadedUrl); continue; }
      if (!photo.file) continue;
      const fd = new FormData();
      fd.append('file', photo.file, 'photo.jpg');
      const res = await uploadInterventionFileAction(fd, 'photos');
      if (res.url) urls.push(res.url);
    }
    return urls;
  }

  // ── Signature ─────────────────────────────────────────────────────────────

  async function handleSignatureSave(blob: Blob) {
    setSavingSig(true);
    const fd = new FormData();
    fd.append('file', blob, 'signature.png');
    const res = await uploadInterventionFileAction(fd, 'signatures');
    setSavingSig(false);
    if (res.url) {
      setSignatureUrl(res.url);
      setShowSig(false);
    }
  }

  // ── Save (brouillon / planifiée) ───────────────────────────────────────────

  async function handleSave() {
    if (!clientId) { setError('Veuillez sélectionner un client.'); return; }
    setSaving(true);
    setError('');
    const photoUrls = await uploadPendingPhotos();

    const input = {
      client_id:      clientId,
      projet_id:      null,
      technicien_id:  currentUserId,
      date:           new Date(date).toISOString(),
      type,
      statut:         'planifiee' as const,
      duree_minutes:  null,
      notes:          notes.trim() || null,
      adresse:        adresse.trim() || null,
      photos:         photoUrls,
      checklist,
      materiel,
      signature_url:  signatureUrl,
    };

    const res = editing
      ? await updateInterventionAction(editing.id, input)
      : await createInterventionAction(input);

    setSaving(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Terminer ───────────────────────────────────────────────────────────────

  async function handleTerminer() {
    if (!editing) return;
    if (timer.running) timer.pause();
    setTerminating(true);
    setError('');
    const photoUrls = await uploadPendingPhotos();
    const res = await terminerInterventionAction(
      editing.id,
      timer.minutes,
      checklist,
      materiel,
      notes.trim() || null,
      photoUrls,
      signatureUrl,
    );
    setTerminating(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedType = TYPE_ITEMS.find((t) => t.value === type)!;

  return (
    <div className="fixed inset-0 z-50 bg-oxi-bg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-oxi-surface border-b border-oxi-border px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-oxi-border hover:bg-oxi-bg transition-colors"
          aria-label="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-oxi-text-muted" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-oxi-text truncate">
            {editing ? `${selectedType.label} — ${editing.client_nom ?? ''}` : 'Nouvelle intervention'}
          </p>
          {editing && (
            <p className="text-xs text-oxi-text-muted capitalize">{editing.statut.replace('_', ' ')}</p>
          )}
        </div>
        {/* Timer display in header */}
        {editing && !isTerminee && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-oxi-primary tabular-nums">{timer.display}</span>
            <button
              type="button"
              onClick={timer.running ? timer.pause : timer.start}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                timer.running ? 'bg-oxi-danger text-white' : 'bg-oxi-primary text-white',
              ].join(' ')}
            >
              {timer.running ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mx-auto max-w-xl space-y-6 px-4 py-5">
        {error && <div className="rounded-xl bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

        {/* ── Client + Date ── */}
        <Section title="Informations">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldCls} disabled={isTerminee}>
            <option value="">— Client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          {/* Type */}
          <div className="grid grid-cols-4 gap-2">
            {TYPE_ITEMS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => !isTerminee && setType(t.value)}
                className={[
                  'rounded-xl border py-3 text-xs font-bold transition-colors',
                  type === t.value ? t.color : 'border-oxi-border text-oxi-text-secondary',
                  isTerminee ? 'cursor-default' : 'hover:border-oxi-primary',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldCls}
            disabled={isTerminee}
          />

          <input
            type="text"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Adresse d'intervention"
            className={fieldCls}
            disabled={isTerminee}
          />
        </Section>

        {/* ── Checklist ── */}
        <Section title="Checklist">
          {checklist.length > 0 && (
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-oxi-border bg-oxi-surface px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      item.done ? 'border-oxi-success bg-oxi-success text-white' : 'border-oxi-border',
                    ].join(' ')}
                  >
                    {item.done && (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-oxi-text-muted' : 'text-oxi-text'}`}>
                    {item.label}
                  </span>
                  {!isTerminee && (
                    <button type="button" onClick={() => removeChecklistItem(item.id)} className="text-oxi-text-muted hover:text-oxi-danger transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isTerminee && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                placeholder="Ajouter une étape…"
                className={fieldCls}
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-oxi-primary text-white hover:bg-oxi-primary-hover transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          )}
        </Section>

        {/* ── Matériel ── */}
        <Section title="Matériel utilisé">
          {materiel.map((m) => (
            <div key={m.id} className="rounded-xl border border-oxi-border bg-oxi-surface p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={m.designation}
                  onChange={(e) => updateMateriel(m.id, 'designation', e.target.value)}
                  placeholder="Désignation"
                  list={`catalogue-${m.id}`}
                  className={`${fieldCls} flex-1`}
                  disabled={isTerminee}
                />
                <datalist id={`catalogue-${m.id}`}>
                  {catalogue.map((c) => <option key={c.id} value={c.designation}>{c.ref}</option>)}
                </datalist>
                <input
                  type="text"
                  value={m.reference ?? ''}
                  onChange={(e) => updateMateriel(m.id, 'reference', e.target.value || null!)}
                  placeholder="Réf."
                  className={`${fieldCls} w-24`}
                  disabled={isTerminee}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-oxi-text-muted">Qté</label>
                <input
                  type="number"
                  value={m.quantite}
                  onChange={(e) => updateMateriel(m.id, 'quantite', parseInt(e.target.value) || 1)}
                  min="1"
                  className={`${fieldCls} w-20`}
                  disabled={isTerminee}
                />
                {!isTerminee && (
                  <button type="button" onClick={() => removeMateriel(m.id)} className="ml-auto text-xs text-oxi-danger hover:underline">
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
          {!isTerminee && (
            <button
              type="button"
              onClick={addMateriel}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-oxi-border py-3 text-sm font-medium text-oxi-text-secondary hover:border-oxi-primary hover:text-oxi-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Ajouter du matériel
            </button>
          )}
        </Section>

        {/* ── Photos ── */}
        <Section title={`Photos (${photos.length})`}>
          <PhotoUpload photos={photos} onChange={setPhotos} disabled={isTerminee} />
        </Section>

        {/* ── Notes ── */}
        <Section title="Notes et commentaires">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Observations, remarques, consignes de suivi…"
            className={`${fieldCls} resize-none`}
            disabled={isTerminee}
          />
        </Section>

        {/* ── Signature ── */}
        <Section title="Signature client">
          {signatureUrl ? (
            <div className="rounded-xl border border-oxi-border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureUrl} alt="Signature client" className="max-h-20 mx-auto" />
              {!isTerminee && (
                <button type="button" onClick={() => setSignatureUrl(null)} className="mt-2 w-full text-xs text-oxi-danger hover:underline">
                  Effacer la signature
                </button>
              )}
            </div>
          ) : !isTerminee ? (
            showSig ? (
              <SignatureCanvas onSave={handleSignatureSave} onCancel={() => setShowSig(false)} saving={savingSig} />
            ) : (
              <button
                type="button"
                onClick={() => setShowSig(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-oxi-border py-4 text-sm font-medium text-oxi-text-secondary hover:border-oxi-primary hover:text-oxi-primary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
                Recueillir la signature client
              </button>
            )
          ) : (
            <p className="text-sm text-oxi-text-muted">Aucune signature</p>
          )}
        </Section>

        {/* ── Rapport PDF (si terminée) ── */}
        {isTerminee && editing && (
          <RapportPDF
            intervention={{
              ...editing,
              client_nom:     editing.client_nom     ?? '—',
              technicien_nom: editing.technicien_nom ?? '—',
            }}
          />
        )}

        {/* ── Actions ── */}
        <div className="space-y-3 pb-8">
          {!isTerminee && (
            <>
              {/* Terminer */}
              {editing && (
                <button
                  type="button"
                  onClick={handleTerminer}
                  disabled={terminating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-oxi-success py-4 text-base font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {terminating ? 'Clôture en cours…' : 'Terminer l\'intervention'}
                </button>
              )}
              {/* Enregistrer */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || terminating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-oxi-border bg-oxi-surface py-4 text-base font-semibold text-oxi-text hover:bg-oxi-bg transition-colors disabled:opacity-60"
              >
                {saving ? 'Enregistrement…' : editing ? 'Sauvegarder' : 'Créer l\'intervention'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
