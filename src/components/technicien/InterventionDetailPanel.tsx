'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlideOver }        from '@/components/ui/SlideOver';
import { SignatureCanvas }  from './SignatureCanvas';
import type { SignatureCanvasHandle } from './SignatureCanvas';
import { PhotoUpload }      from './PhotoUpload';
import type { PhotoEntry }  from './PhotoUpload';
import {
  updateInterventionStatus,
  saveInterventionProgress,
  saveInterventionSignature,
  sendInterventionReport,
  uploadAndSaveInterventionPhoto,
  deleteInterventionPhoto,
} from '@/app/actions/technicien';
import type { PlanningIntervention, ChecklistItem, MaterialItem } from '@/app/actions/technicien';
import type { InterventionWithSignature } from '@/lib/intervention-pdf';
import { getTenantInfoForPdf } from '@/app/actions/users-management';
import {
  uploadDocumentAction,
  getDocumentUrlAction,
  deleteDocumentAction,
} from '@/app/actions/documents';
import type { DocumentEntry } from '@/app/actions/documents';

// ── Types & helpers ───────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  planifiee: { label: 'Planifiée',  cls: 'bg-blue-100   text-[#2563eb]' },
  en_cours:  { label: 'En cours',   cls: 'bg-orange-100 text-[#d97706]' },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-[#16a34a]' },
  annulee:   { label: 'Annulée',    cls: 'bg-slate-100  text-slate-400' },
};

const TYPE_INT_LABELS: Record<string, string> = {
  reseau:     'Réseau / Fibre',
  securite:   'Sécurité',
  telephonie: 'Téléphonie',
  autre:      'Autre',
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtHour(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function fmtDuration(startIso: string, endIso: string) {
  const totalMins = Math.floor(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}

function fmtLongDateTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// ── Accordéon ─────────────────────────────────────────────────────────────────

function AccordionSection({
  title, badge, isOpen, onToggle, children,
}: {
  title:    string;
  badge?:   React.ReactNode;
  isOpen:   boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#dde3f0] bg-white shadow-sm mb-3 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {badge}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={2} stroke="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Helpers documents ─────────────────────────────────────────────────────────

function getFileIcon(ext: string): string {
  const t = ext.toLowerCase();
  if (['cfg', 'xml', 'json', 'yaml', 'yml', 'ini', 'conf'].includes(t)) return '⚙️';
  if (t === 'pdf') return '📕';
  if (['xlsx', 'xls', 'csv', 'ods'].includes(t)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(t)) return '🖼️';
  if (['txt', 'log', 'md', 'docx', 'doc', 'rtf'].includes(t)) return '📄';
  return '📁';
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function fmtShortDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5 Mo

// ── Helper : URL → base64 data URL pour jsPDF ────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader   = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  intervention:   PlanningIntervention | null;
  onClose:        () => void;
  onStatusChange: (id: string, newStatus: string) => void;
  onSaveProgress: (id: string, updates: Partial<PlanningIntervention>) => void;
}

// ── Composant principal ───────────────────────────────────────────────────────

export function InterventionDetailPanel({
  intervention, onClose, onStatusChange, onSaveProgress,
}: Props) {
  const router = useRouter();
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [isSaving,        setIsSaving]           = useState(false);
  const [isSendingReport, setIsSendingReport]    = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf]  = useState(false);
  const [error,           setError]              = useState('');
  const [reportSent,      setReportSent]         = useState(false);
  const [reportSuccess,   setReportSuccess]      = useState('');
  const [elapsed,         setElapsed]            = useState(0);

  // Signature
  const canvasRef                               = useRef<SignatureCanvasHandle>(null);
  const [signerName,         setSignerName]     = useState('');
  const [signatureValidated, setSignatureValidated] = useState(false);
  const [signatureData,      setSignatureData]  = useState<string | null>(null);
  const [signatureDate,      setSignatureDate]  = useState<string | null>(null);
  const [isSigningSaving,    setIsSigningSaving] = useState(false);

  // Photos
  const [localPhotos,      setLocalPhotos]      = useState<PhotoEntry[]>([]);
  const [fullscreenPhoto,  setFullscreenPhoto]  = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Documents
  const [localDocs,      setLocalDocs]      = useState<DocumentEntry[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docDescription, setDocDescription] = useState('');
  const [deletingDocId,  setDeletingDocId]  = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // État local des sections accordéon
  const [open, setOpen] = useState({
    infos: true, pointage: false, checklist: false, materiaux: false, photos: false, documents: false, rapport: false,
  });

  // État local du contenu éditable
  const [localChecklist,    setLocalChecklist]    = useState<ChecklistItem[]>([]);
  const [localMaterials,    setLocalMaterials]    = useState<MaterialItem[]>([]);
  const [localObservations, setLocalObservations] = useState('');
  const [newTaskLabel,      setNewTaskLabel]      = useState('');
  const [showMatForm,       setShowMatForm]       = useState(false);
  const [newMat, setNewMat] = useState({ designation: '', marque: '', modele: '', serial: '', location: '' });

  // Reset quand l'intervention change
  useEffect(() => {
    if (!intervention) return;
    const iv = intervention as InterventionWithSignature;
    setLocalChecklist(iv.checklist          ?? []);
    setLocalMaterials(iv.materials_installed ?? []);
    setLocalObservations(iv.observations    ?? '');
    setLocalDocs(iv.documents               ?? []);
    setReportSent(iv.report_sent            ?? false);
    setReportSuccess('');
    setError('');
    setShowMatForm(false);
    setDocDescription('');
    setDeletingDocId(null);
    setOpen({ infos: true, pointage: false, checklist: false, materiaux: false, photos: false, documents: false, rapport: false });

    // Photos existantes
    const existingPhotos = iv.photos ?? [];
    setLocalPhotos(existingPhotos.map((p) => ({
      id:          crypto.randomUUID(),
      previewUrl:  p.url,
      uploadedUrl: p.url,
      storagePath: p.path,
    })));

    // Signature existante
    const hasSig = !!(iv.signature_data);
    setSignerName(iv.signature_name ?? '');
    setSignatureData(iv.signature_data ?? null);
    setSignatureDate(iv.signature_date ?? null);
    setSignatureValidated(hasSig);

    // Chrono
    if (iv.status === 'en_cours' && iv.hour_start) {
      setElapsed(Math.floor((Date.now() - new Date(iv.hour_start).getTime()) / 1000));
    } else {
      setElapsed(0);
    }
  }, [intervention?.id]);

  // Chronomètre live
  useEffect(() => {
    if (intervention?.status !== 'en_cours' || !intervention?.hour_start) return;
    const startMs  = new Date(intervention.hour_start).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [intervention?.status, intervention?.hour_start]);

  if (!intervention) return null;
  const iv = intervention as InterventionWithSignature;

  const cfg        = STATUS_CFG[iv.status] ?? { label: iv.status, cls: 'bg-slate-100 text-slate-500' };
  const clientNom  = iv.client_name    ?? iv.clients?.nom    ?? null;
  const clientAddr = iv.client_address ?? iv.clients?.adresse ?? null;
  const clientCity = iv.client_city    ?? iv.clients?.ville  ?? null;
  const clientTel  = iv.client_phone   ?? iv.clients?.tel    ?? null;
  const fullAddr   = [clientAddr, clientCity].filter(Boolean).join(', ');

  const actualMinutes = (iv.hour_start && iv.hour_end)
    ? Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000)
    : null;
  const depassementMin = (iv.hours_planned != null && actualMinutes != null)
    ? Math.round(actualMinutes - iv.hours_planned * 60)
    : null;

  const devisMaterials  = localMaterials.filter((m) => m.from_devis);
  const manualMaterials = localMaterials.filter((m) => !m.from_devis);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function toggleSection(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleChecklistToggle(itemId: string) {
    const updated = localChecklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
    setLocalChecklist(updated);
    saveInterventionProgress(iv.id, { checklist: updated }).then(() => {
      onSaveProgress(iv.id, { checklist: updated });
    });
  }

  function handleAddTask() {
    if (!newTaskLabel.trim()) return;
    const updated = [...localChecklist, { id: crypto.randomUUID(), label: newTaskLabel.trim(), done: false }];
    setLocalChecklist(updated);
    setNewTaskLabel('');
    saveInterventionProgress(iv.id, { checklist: updated }).then(() => {
      onSaveProgress(iv.id, { checklist: updated });
    });
  }

  function updateMaterialField(id: string, field: string, value: string) {
    setLocalMaterials((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }

  function handleAddMaterial() {
    if (!newMat.designation && !newMat.marque) return;
    const item: MaterialItem = {
      id:          crypto.randomUUID(),
      designation: newMat.designation || undefined,
      marque:      newMat.marque      || undefined,
      modele:      newMat.modele      || undefined,
      serial:      newMat.serial      || undefined,
      location:    newMat.location    || undefined,
      from_devis:  false,
    };
    setLocalMaterials((prev) => [...prev, item]);
    setNewMat({ designation: '', marque: '', modele: '', serial: '', location: '' });
    setShowMatForm(false);
  }

  function handleRemoveManualMaterial(id: string) {
    setLocalMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSave() {
    setIsSaving(true);
    setError('');
    const updates = { observations: localObservations || null, materials_installed: localMaterials };
    const res = await saveInterventionProgress(iv.id, updates);
    setIsSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaveProgress(iv.id, updates);
  }

  async function handleDocUpload(file: File) {
    if (file.size > MAX_DOC_SIZE) { setError(`Fichier trop volumineux (max 5 Mo) : ${file.name}`); return; }
    setIsUploadingDoc(true);
    setError('');
    const base64: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const res = await uploadDocumentAction(
      iv.id,
      { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, base64 },
      docDescription || undefined,
    );
    setIsUploadingDoc(false);
    if (res.error) { setError(`Erreur upload : ${res.error}`); return; }
    if (res.doc) {
      setLocalDocs((prev) => [...prev, res.doc!]);
      setDocDescription('');
    }
  }

  function handleDocInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => handleDocUpload(f));
    e.target.value = '';
  }

  async function handleDocDownload(doc: DocumentEntry) {
    const url = await getDocumentUrlAction(doc.storage_path);
    if (url) window.open(url, '_blank');
    else setError('Impossible de récupérer le lien du document.');
  }

  async function handleDocDelete(doc: DocumentEntry) {
    if (!confirm(`Supprimer "${doc.name}" ?`)) return;
    setDeletingDocId(doc.id);
    const res = await deleteDocumentAction(iv.id, doc.id);
    setDeletingDocId(null);
    if (res.error) { setError(res.error); return; }
    setLocalDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  async function handlePhotosChange(newPhotos: PhotoEntry[]) {
    // Supprimer les photos retirées du storage
    const removed = localPhotos.filter(
      (p) => p.storagePath && !newPhotos.find((np) => np.id === p.id),
    );
    setLocalPhotos(newPhotos);
    for (const p of removed) {
      await deleteInterventionPhoto(iv.id, p.storagePath!);
    }

    // Uploader les nouvelles (file présent, pas encore uploadé)
    const toUpload = newPhotos.filter((p) => p.file && !p.uploadedUrl);
    if (toUpload.length === 0) return;

    setIsUploadingPhoto(true);
    setError('');
    const updated = [...newPhotos];

    for (const entry of toUpload) {
      const fd = new FormData();
      fd.append('file', entry.file!, 'photo.jpg');
      const res = await uploadAndSaveInterventionPhoto(iv.id, fd);
      if (res.error) { setError(`Erreur upload: ${res.error}`); continue; }
      const idx = updated.findIndex((p) => p.id === entry.id);
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          uploadedUrl: res.url!,
          storagePath: res.path!,
          previewUrl:  res.url!,
          file:        undefined,
        };
      }
    }

    setLocalPhotos(updated);
    setIsUploadingPhoto(false);
  }

  function handleStatus(newStatus: 'planifiee' | 'en_cours' | 'terminee') {
    setError('');
    const now = new Date().toISOString();
    startStatusTransition(async () => {
      const res = await updateInterventionStatus(iv.id, newStatus, now);
      if (res.error) { setError(res.error); return; }
      onStatusChange(iv.id, newStatus);
      if (newStatus === 'en_cours') onSaveProgress(iv.id, { hour_start: now, status: newStatus });
      if (newStatus === 'terminee') onSaveProgress(iv.id, { hour_end:   now, status: newStatus });
    });
  }

  async function handleValidateSignature() {
    console.log('[Signature] Validate clicked');
    const data = canvasRef.current?.getDataURL();
    console.log('[Signature] Canvas data length:', data?.length ?? 0);
    if (!data) { setError('Veuillez signer dans le cadre avant de valider.'); return; }
    if (!signerName.trim()) { setError('Veuillez saisir le nom du signataire.'); return; }
    setIsSigningSaving(true);
    setError('');
    const res = await saveInterventionSignature(iv.id, data, signerName.trim());
    console.log('[Signature] Supabase save result:', JSON.stringify(res));
    setIsSigningSaving(false);
    if (res.error) { setError(res.error); return; }
    const now = new Date().toISOString();
    setSignatureData(data);
    setSignatureDate(now);
    setSignatureValidated(true);
    onSaveProgress(iv.id, {
      signature_data: data,
      signature_name: signerName,
      signature_date: now,
    } as Partial<PlanningIntervention>);
  }

  async function handleDownloadPdf() {
    setIsDownloadingPdf(true);
    try {
      const { generateInterventionPDF } = await import('@/lib/intervention-pdf');
      const uploadedPhotos = localPhotos.filter((p) => p.uploadedUrl);
      const photosBase64   = (await Promise.all(uploadedPhotos.map((p) => fetchImageAsBase64(p.uploadedUrl!)))).filter(Boolean) as string[];
      const ivWithSig: InterventionWithSignature = {
        ...iv,
        signature_data: signatureData,
        signature_name: signerName,
        signature_date: signatureDate,
        photos_base64:  photosBase64,
      };
      const tenantInfo  = await getTenantInfoForPdf();
      const logoBase64  = tenantInfo.logoUrl ? await fetchImageAsBase64(tenantInfo.logoUrl) : null;
      const blob        = await generateInterventionPDF(ivWithSig, {
        name:    tenantInfo.name,
        logoUrl: logoBase64,
      });
      const url     = URL.createObjectURL(blob);
      const anchor  = document.createElement('a');
      anchor.href   = url;
      anchor.download = `rapport-intervention-${iv.id.substring(0, 8)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur génération PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleSendReport() {
    setIsSendingReport(true);
    setError('');

    // Générer le PDF côté client, encoder en base64
    let pdfBase64: string | undefined;
    try {
      const { generateInterventionPDF } = await import('@/lib/intervention-pdf');
      const uploadedPhotos = localPhotos.filter((p) => p.uploadedUrl);
      const photosBase64   = (await Promise.all(uploadedPhotos.map((p) => fetchImageAsBase64(p.uploadedUrl!)))).filter(Boolean) as string[];
      const ivWithSig: InterventionWithSignature = {
        ...iv,
        signature_data: signatureData,
        signature_name: signerName,
        signature_date: signatureDate,
        photos_base64:  photosBase64,
      };
      const tenantInfo = await getTenantInfoForPdf();
      const logoBase64 = tenantInfo.logoUrl ? await fetchImageAsBase64(tenantInfo.logoUrl) : null;
      const blob       = await generateInterventionPDF(ivWithSig, {
        name:    tenantInfo.name,
        logoUrl: logoBase64,
      });
      const ab     = await blob.arrayBuffer();
      const uint8  = new Uint8Array(ab);
      pdfBase64    = btoa(uint8.reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
    } catch {
      // Fallback : envoyer sans PDF joint
    }

    const res = await sendInterventionReport(iv.id, pdfBase64);
    setIsSendingReport(false);
    if (res.error) { setError(res.error); return; }
    setReportSent(true);
    setReportSuccess(`✅ Rapport envoyé à ${res.recipientEmail}`);
    onSaveProgress(iv.id, { report_sent: true, report_sent_to: res.recipientEmail ?? null });
  }

  const checkDone  = localChecklist.filter((c) => c.done).length;
  const checkTotal = localChecklist.length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SlideOver open={!!intervention} onClose={onClose} title="Fiche intervention" width="lg">
      <div className="pb-32">

        {/* Messages */}
        {error && (
          <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {reportSuccess && (
          <div className="mx-5 mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-semibold">
            {reportSuccess}
          </div>
        )}

        {/* Titre + badge */}
        <div className="rounded-xl border border-[#dde3f0] bg-white shadow-sm mb-3 flex flex-wrap items-center gap-3 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800 flex-1">{iv.title}</h3>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
          {iv.nature === 'sav' && (
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
              iv.urgency === 'critique' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {iv.urgency === 'critique' ? '🚨 SAV Critique' : '🔧 SAV'}
            </span>
          )}
        </div>

        {/* ── Section 1 : Infos chantier ──────────────────────────────────── */}
        <AccordionSection
          title="Informations chantier"
          isOpen={open.infos}
          onToggle={() => toggleSection('infos')}
        >
          <div className="space-y-4">
            {/* Badges nature / contrat */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                iv.nature === 'sav' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {iv.nature === 'sav' ? '🔧 SAV' : '🏗 Projet'}
              </span>
              {iv.nature === 'sav' && (
                iv.under_contract
                  ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">✅ Sous contrat</span>
                  : <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">⚠ Hors contrat</span>
              )}
            </div>

            {iv.nature === 'sav' && iv.observations && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Description du problème</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{iv.observations}</p>
              </div>
            )}

            {/* Grille 2 colonnes sur desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Date</p>
                <p className="text-sm text-slate-800">{fmtDateTime(iv.date_start)}</p>
                {iv.date_end && <p className="text-xs text-slate-400 mt-0.5">→ {fmtDateTime(iv.date_end)}</p>}
              </div>

              {iv.type_intervention && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Type</p>
                  <p className="text-sm text-slate-800">{TYPE_INT_LABELS[iv.type_intervention] ?? iv.type_intervention}</p>
                </div>
              )}

              {iv.hours_planned != null && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Heures prévues</p>
                  <p className="text-sm text-slate-800">{iv.hours_planned}h</p>
                </div>
              )}

              {clientNom && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Client</p>
                  <p className="text-sm font-semibold text-slate-800">{clientNom}</p>
                  {fullAddr && <p className="text-xs text-slate-500 mt-0.5">📍 {fullAddr}</p>}
                  {clientTel && <p className="text-xs text-slate-500 mt-0.5">📞 {clientTel}</p>}
                </div>
              )}
            </div>

            {/* Boutons d'action en ligne */}
            <div className="flex flex-wrap gap-2">
              {fullAddr && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddr)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  📍 GPS
                </a>
              )}
              {clientTel && (
                <a
                  href={`tel:${clientTel}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  📞 Appeler
                </a>
              )}
              {iv.client_id && (
                <button
                  type="button"
                  onClick={() => { onClose(); router.push(`/commerce?tab=clients&id=${iv.client_id}`); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  👤 Fiche Client
                </button>
              )}
            </div>

            {iv.observations && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{iv.observations}</p>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 2 : Pointage heures ─────────────────────────────────── */}
        <AccordionSection
          title="Pointage heures"
          badge={
            iv.status === 'en_cours' ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600 animate-pulse">
                ● En cours
              </span>
            ) : undefined
          }
          isOpen={open.pointage}
          onToggle={() => toggleSection('pointage')}
        >
          <div className="space-y-4">
            {iv.status === 'en_cours' && (
              <div className="rounded-xl bg-slate-900 px-5 py-6 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Temps écoulé</p>
                <p className="font-mono text-4xl font-bold text-white tracking-widest">{fmtElapsed(elapsed)}</p>
              </div>
            )}
            {/* Début / Fin / Durée sur 3 colonnes */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 border border-[#dde3f0] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Début</p>
                <p className="text-sm font-medium text-slate-800">{iv.hour_start ? fmtHour(iv.hour_start) : <span className="text-slate-300">—</span>}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-[#dde3f0] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Fin</p>
                <p className="text-sm font-medium text-slate-800">{iv.hour_end ? fmtHour(iv.hour_end) : <span className="text-slate-300">—</span>}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-[#dde3f0] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Durée</p>
                <p className="text-sm font-bold text-slate-800">{iv.hour_start && iv.hour_end ? fmtDuration(iv.hour_start, iv.hour_end) : <span className="text-slate-300">—</span>}</p>
              </div>
            </div>
            {iv.hours_planned != null && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Heures prévues</span>
                <span className="font-medium text-slate-800">{iv.hours_planned}h</span>
              </div>
            )}
            {depassementMin != null && depassementMin > 0 && (
              <p className="text-xs font-semibold text-red-500">
                ⚠ Dépassement de {depassementMin >= 60
                  ? `${Math.floor(depassementMin / 60)}h${(depassementMin % 60).toString().padStart(2, '0')}`
                  : `${depassementMin}min`}
              </p>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 3 : Checklist ───────────────────────────────────────── */}
        <AccordionSection
          title="Checklist"
          badge={
            checkTotal > 0 ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                checkDone === checkTotal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {checkDone}/{checkTotal}
              </span>
            ) : undefined
          }
          isOpen={open.checklist}
          onToggle={() => toggleSection('checklist')}
        >
          <div className="space-y-2">
            {localChecklist.length === 0 && (
              <p className="text-xs text-slate-400">Aucune tâche. Ajoutez-en ci-dessous.</p>
            )}
            {localChecklist.map((item) => (
              <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleChecklistToggle(item.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.label}
                </span>
              </label>
            ))}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Nouvelle tâche…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button" onClick={handleAddTask}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>
        </AccordionSection>

        {/* ── Section 4 : Matériel installé ───────────────────────────────── */}
        <AccordionSection
          title="Matériel installé"
          badge={
            localMaterials.length > 0 ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                ✅ {localMaterials.length}
              </span>
            ) : undefined
          }
          isOpen={open.materiaux}
          onToggle={() => toggleSection('materiaux')}
        >
          <div className="space-y-3">
            {localMaterials.length === 0 && !showMatForm && (
              <p className="text-xs text-slate-400">Aucun matériel renseigné.</p>
            )}

            {devisMaterials.map((m) => (
              <div key={m.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.designation || 'Matériel sans désignation'}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                      {m.reference && <span>Réf: {m.reference}</span>}
                      {m.quantite  && <span>Qté: {m.quantite}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">📋 Devis</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['marque', 'modele', 'serial', 'location'] as const).map((field) => (
                    <input
                      key={field}
                      type="text"
                      value={(m[field] as string | undefined) ?? ''}
                      onChange={(e) => updateMaterialField(m.id, field, e.target.value)}
                      placeholder={field === 'marque' ? 'Marque' : field === 'modele' ? 'Modèle' : field === 'serial' ? 'N° série' : 'Localisation'}
                      className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    />
                  ))}
                </div>
              </div>
            ))}

            {manualMaterials.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">{m.designation || [m.marque, m.modele].filter(Boolean).join(' ') || 'Matériel'}</p>
                    {m.serial   && <p className="text-slate-500">N° série : {m.serial}</p>}
                    {m.location && <p className="text-slate-500">Local. : {m.location}</p>}
                  </div>
                  <button type="button" onClick={() => handleRemoveManualMaterial(m.id)} className="text-slate-400 hover:text-red-500 transition-colors" aria-label="Supprimer">✕</button>
                </div>
              </div>
            ))}

            {showMatForm ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                {(['designation', 'marque', 'modele', 'serial', 'location'] as const).map((field) => (
                  <input
                    key={field}
                    type="text"
                    value={newMat[field]}
                    onChange={(e) => setNewMat((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={field === 'designation' ? 'Désignation (ex: Switch PoE 24 ports)' : field === 'marque' ? 'Marque' : field === 'modele' ? 'Modèle' : field === 'serial' ? 'N° série' : 'Localisation'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                ))}
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddMaterial} className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">Ajouter</button>
                  <button type="button" onClick={() => setShowMatForm(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">Annuler</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowMatForm(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                + Ajouter du matériel
              </button>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 5 : Photos ─────────────────────────────────────────── */}
        <AccordionSection
          title="Photos"
          badge={
            localPhotos.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {localPhotos.length}
              </span>
            ) : undefined
          }
          isOpen={open.photos}
          onToggle={() => toggleSection('photos')}
        >
          {isUploadingPhoto && (
            <p className="mb-2 text-xs text-blue-600 animate-pulse">Envoi en cours…</p>
          )}
          <PhotoUpload
            photos={localPhotos}
            onChange={handlePhotosChange}
            onPhotoClick={setFullscreenPhoto}
          />
        </AccordionSection>

        {/* ── Section 6 : Documents ─────────────────────────────────────── */}
        <AccordionSection
          title="Documents"
          badge={
            localDocs.length > 0 ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                📁 {localDocs.length}
              </span>
            ) : undefined
          }
          isOpen={open.documents}
          onToggle={() => toggleSection('documents')}
        >
          <div className="space-y-3">
            {/* Description optionnelle */}
            <input
              type="text"
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="Description (optionnelle)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Zone drag & drop / clic */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => docInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && docInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                Array.from(e.dataTransfer.files).forEach((f) => handleDocUpload(f));
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors min-h-[80px]"
            >
              {isUploadingDoc ? (
                <p className="text-sm text-blue-600 animate-pulse">Envoi en cours…</p>
              ) : (
                <>
                  <span className="text-2xl">📎</span>
                  <p className="text-xs font-semibold text-slate-600">Glissez des fichiers ici<br/>ou appuyez pour sélectionner</p>
                  <p className="text-[10px] text-slate-400">PDF, configs, plans, Excel… (max 5 Mo)</p>
                </>
              )}
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept="*/*"
              multiple
              className="hidden"
              onChange={handleDocInputChange}
            />

            {/* Liste des documents */}
            {localDocs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun document attaché.</p>
            ) : (
              <div className="space-y-2">
                {localDocs.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-xl shrink-0 mt-0.5">{getFileIcon(doc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{doc.name}</p>
                      {doc.description && (
                        <p className="text-xs italic text-slate-400 truncate">{doc.description}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmtSize(doc.size)} · {fmtShortDate(doc.uploaded_at)} · {doc.uploaded_by}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDocDownload(doc)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors text-sm"
                        title="Télécharger"
                      >
                        ⬇
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocDelete(doc)}
                        disabled={deletingDocId === doc.id}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors text-sm"
                        title="Supprimer"
                      >
                        {deletingDocId === doc.id ? '…' : '✕'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 7 : Rapport & Signature client ──────────────────────── */}
        <AccordionSection
          title="Rapport & Signature client"
          badge={
            signatureValidated ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✅ Signé</span>
            ) : undefined
          }
          isOpen={open.rapport}
          onToggle={() => toggleSection('rapport')}
        >
          <div className="space-y-5">

            {/* A) Observations du technicien */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Observations du technicien
              </label>
              <textarea
                value={localObservations}
                onChange={(e) => setLocalObservations(e.target.value)}
                rows={4}
                placeholder="Observations, remarques, travaux effectués..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* B) Nom du signataire */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Nom du signataire
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={signatureValidated}
                placeholder="Nom et prénom du client"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            {/* C) Canvas de signature */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Signature client
              </label>

              <SignatureCanvas
                ref={canvasRef}
                readonly={signatureValidated}
                existingData={signatureData}
              />

              {!signatureValidated ? (
                <div className="space-y-2 pt-1">
                  {error && (
                    <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => canvasRef.current?.clear()}
                      className="min-h-[48px] rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      🗑 Effacer
                    </button>
                    <button
                      type="button"
                      onClick={handleValidateSignature}
                      disabled={isSigningSaving}
                      className="flex-1 min-h-[48px] rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
                    >
                      {isSigningSaving ? 'Enregistrement…' : '✅ Valider la signature'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-green-700">
                    ✅ Signé par {signerName}
                    {signatureDate && ` le ${fmtLongDateTime(signatureDate)}`}
                  </p>
                </div>
              )}
            </div>

          </div>
        </AccordionSection>
      </div>

      {/* ── Visionneuse plein écran ──────────────────────────────────────── */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setFullscreenPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenPhoto}
            alt="Photo intervention"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white text-lg hover:bg-white/30 transition-colors"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Footer fixe ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[230px] z-10 border-t border-slate-200 bg-white px-5 py-4 md:px-6">
        <div className="max-w-[900px] mx-auto flex gap-2 justify-end flex-wrap">
        <button
          type="button" onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Fermer
        </button>
        <button
          type="button" onClick={handleSave} disabled={isSaving}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {isSaving ? '…' : '💾 Sauvegarder'}
        </button>

        {iv.status === 'planifiee' && (
          <button type="button" onClick={() => handleStatus('en_cours')} disabled={isPendingStatus}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {isPendingStatus ? '…' : '🚀 Démarrer'}
          </button>
        )}

        {iv.status === 'en_cours' && (
          <button type="button" onClick={() => handleStatus('terminee')} disabled={isPendingStatus}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
            {isPendingStatus ? '…' : '✅ Terminer'}
          </button>
        )}

        {iv.status === 'terminee' && (
          <button type="button" onClick={handleDownloadPdf} disabled={isDownloadingPdf}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {isDownloadingPdf ? '…' : '📄 Télécharger PDF'}
          </button>
        )}

        {iv.status === 'terminee' && (
          <button type="button" onClick={handleSendReport} disabled={isSendingReport || reportSent}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              reportSent
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            }`}>
            {isSendingReport ? '…' : reportSent ? '✅ Rapport envoyé' : '📧 Envoyer le rapport'}
          </button>
        )}
        </div>
      </div>
    </SlideOver>
  );
}
