'use client';

import { useState, useEffect, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import {
  updateInterventionStatus,
  saveInterventionProgress,
  sendInterventionReport,
} from '@/app/actions/technicien';
import type { PlanningIntervention, ChecklistItem, MaterialItem } from '@/app/actions/technicien';

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
    <div className="border-b border-slate-100 last:border-b-0">
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
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [isSaving,        setIsSaving]           = useState(false);
  const [isSendingReport, setIsSendingReport]    = useState(false);
  const [error,           setError]              = useState('');
  const [reportSent,      setReportSent]         = useState(false);
  const [reportSuccess,   setReportSuccess]      = useState('');
  const [elapsed,         setElapsed]            = useState(0);

  // État local des sections accordéon
  const [open, setOpen] = useState({
    infos: true, pointage: false, checklist: false, materiaux: false, photos: false, rapport: false,
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
    setLocalChecklist(intervention.checklist          ?? []);
    setLocalMaterials(intervention.materials_installed ?? []);
    setLocalObservations(intervention.observations    ?? '');
    setReportSent(intervention.report_sent            ?? false);
    setReportSuccess('');
    setError('');
    setShowMatForm(false);
    setOpen({ infos: true, pointage: false, checklist: false, materiaux: false, photos: false, rapport: false });

    // Initialiser le chronomètre depuis hour_start
    if (intervention.status === 'en_cours' && intervention.hour_start) {
      setElapsed(Math.floor((Date.now() - new Date(intervention.hour_start).getTime()) / 1000));
    } else {
      setElapsed(0);
    }
  }, [intervention?.id]);

  // Chronomètre live (tourne quand statut = en_cours)
  useEffect(() => {
    if (intervention?.status !== 'en_cours' || !intervention?.hour_start) return;
    const startMs = new Date(intervention.hour_start).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [intervention?.status, intervention?.hour_start]);

  if (!intervention) return null;
  const iv = intervention; // local const — narrows type for closures

  const cfg        = STATUS_CFG[iv.status] ?? { label: iv.status, cls: 'bg-slate-100 text-slate-500' };
  const clientNom  = iv.client_name    ?? iv.clients?.nom    ?? null;
  const clientAddr = iv.client_address ?? iv.clients?.adresse ?? null;
  const clientCity = iv.client_city    ?? iv.clients?.ville  ?? null;
  const clientTel  = iv.client_phone   ?? iv.clients?.tel    ?? null;
  const fullAddr   = [clientAddr, clientCity].filter(Boolean).join(', ');

  // Calculs durée / dépassement
  const actualMinutes = (iv.hour_start && iv.hour_end)
    ? Math.floor((new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000)
    : null;
  const depassementMin = (iv.hours_planned != null && actualMinutes != null)
    ? Math.round(actualMinutes - iv.hours_planned * 60)
    : null;

  // Matériaux du devis (non supprimables) vs ajoutés manuellement
  const devisMaterials  = localMaterials.filter((m) => m.from_devis);
  const manualMaterials = localMaterials.filter((m) => !m.from_devis);

  // ── Handlers ────────────────────────────────────────────────────────────────

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
    const updates = {
      observations:        localObservations || null,
      materials_installed: localMaterials,
    };
    const res = await saveInterventionProgress(iv.id, updates);
    setIsSaving(false);
    if (res.error) { setError(res.error); return; }
    onSaveProgress(iv.id, updates);
  }

  function handleStatus(newStatus: 'planifiee' | 'en_cours' | 'terminee') {
    setError('');
    const now = new Date().toISOString();
    startStatusTransition(async () => {
      const res = await updateInterventionStatus(iv.id, newStatus, now);
      if (res.error) { setError(res.error); return; }
      onStatusChange(iv.id, newStatus);
      // Propager l'horodatage au state parent pour que le chrono se mette à jour
      if (newStatus === 'en_cours') onSaveProgress(iv.id, { hour_start: now, status: newStatus });
      if (newStatus === 'terminee') onSaveProgress(iv.id, { hour_end:   now, status: newStatus });
    });
  }

  async function handleSendReport() {
    setIsSendingReport(true);
    setError('');
    const res = await sendInterventionReport(iv.id);
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
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
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
          <div className="space-y-3">
            {/* Nature + contrat */}
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

            {/* Description du problème (SAV uniquement, pré-remplie par le chef de projet) */}
            {iv.nature === 'sav' && iv.observations && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Description du problème</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{iv.observations}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Date</p>
              <p className="text-sm text-slate-800">{fmtDateTime(iv.date_start)}</p>
              {iv.date_end && (
                <p className="text-xs text-slate-400 mt-0.5">→ {fmtDateTime(iv.date_end)}</p>
              )}
            </div>

            {iv.type_intervention && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Type</p>
                <p className="text-sm text-slate-800">
                  {TYPE_INT_LABELS[iv.type_intervention] ?? iv.type_intervention}
                </p>
              </div>
            )}

            {iv.hours_planned != null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Heures prévues</p>
                <p className="text-sm text-slate-800">{iv.hours_planned}h</p>
              </div>
            )}

            {clientNom && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Client</p>
                <p className="text-sm font-semibold text-slate-800">{clientNom}</p>
                {fullAddr && <p className="text-xs text-slate-500 mt-0.5">📍 {fullAddr}</p>}
                {clientTel && <p className="text-xs text-slate-500 mt-0.5">📞 {clientTel}</p>}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {fullAddr && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddr)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  📍 GPS
                </a>
              )}
              {clientTel && (
                <a
                  href={`tel:${clientTel}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  📞 Appeler
                </a>
              )}
            </div>

            {iv.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{iv.notes}</p>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 2 : Pointage heures (readonly + chrono) ─────────────── */}
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
            {/* Chronomètre (affiché seulement si en cours) */}
            {iv.status === 'en_cours' && (
              <div className="rounded-xl bg-slate-900 px-5 py-4 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Temps écoulé</p>
                <p className="font-mono text-3xl font-bold text-white tracking-widest">
                  {fmtElapsed(elapsed)}
                </p>
              </div>
            )}

            {/* Résumé horaires */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Début</span>
                <span className="font-medium text-slate-800">
                  {iv.hour_start ? fmtHour(iv.hour_start) : <span className="text-slate-300">—</span>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Fin</span>
                <span className="font-medium text-slate-800">
                  {iv.hour_end ? fmtHour(iv.hour_end) : <span className="text-slate-300">—</span>}
                </span>
              </div>
              {iv.hour_start && iv.hour_end && (
                <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                  <span className="text-slate-500">Durée réelle</span>
                  <span className="font-bold text-slate-800">{fmtDuration(iv.hour_start, iv.hour_end)}</span>
                </div>
              )}
              {iv.hours_planned != null && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Heures prévues</span>
                  <span className="font-medium text-slate-800">{iv.hours_planned}h</span>
                </div>
              )}
              {depassementMin != null && depassementMin > 0 && (
                <p className="text-xs font-semibold text-red-500 pt-1">
                  ⚠ Dépassement de {depassementMin >= 60
                    ? `${Math.floor(depassementMin / 60)}h${(depassementMin % 60).toString().padStart(2, '0')}`
                    : `${depassementMin}min`}
                </p>
              )}
            </div>
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
                type="button"
                onClick={handleAddTask}
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

            {/* Matériaux du devis (non supprimables, à compléter) */}
            {devisMaterials.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2"
              >
                {/* Infos du devis (readonly) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {m.designation || 'Matériel sans désignation'}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                      {m.reference && <span>Réf: {m.reference}</span>}
                      {m.quantite   && <span>Qté: {m.quantite}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    📋 Devis
                  </span>
                </div>
                {/* Champs à compléter par le technicien */}
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { field: 'marque',   label: 'Marque'       },
                      { field: 'modele',   label: 'Modèle'       },
                      { field: 'serial',   label: 'N° série'     },
                      { field: 'location', label: 'Localisation' },
                    ] as const
                  ).map(({ field, label }) => (
                    <input
                      key={field}
                      type="text"
                      value={(m[field] as string | undefined) ?? ''}
                      onChange={(e) => updateMaterialField(m.id, field, e.target.value)}
                      placeholder={label}
                      className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Matériaux ajoutés manuellement (supprimables) */}
            {manualMaterials.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">
                      {m.designation || [m.marque, m.modele].filter(Boolean).join(' ') || 'Matériel'}
                    </p>
                    {m.serial   && <p className="text-slate-500">N° série : {m.serial}</p>}
                    {m.location && <p className="text-slate-500">Local. : {m.location}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveManualMaterial(m.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Formulaire ajout manuel */}
            {showMatForm ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                {(
                  [
                    { field: 'designation', placeholder: 'Désignation (ex: Switch PoE 24 ports)' },
                    { field: 'marque',      placeholder: 'Marque' },
                    { field: 'modele',      placeholder: 'Modèle' },
                    { field: 'serial',      placeholder: 'N° série' },
                    { field: 'location',    placeholder: 'Localisation' },
                  ] as const
                ).map(({ field, placeholder }) => (
                  <input
                    key={field}
                    type="text"
                    value={newMat[field]}
                    onChange={(e) => setNewMat((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMatForm(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMatForm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                + Ajouter du matériel
              </button>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 5 : Photos ─────────────────────────────────────────── */}
        <AccordionSection
          title="Photos"
          isOpen={open.photos}
          onToggle={() => toggleSection('photos')}
        >
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-2xl mb-2">📷</p>
            <p className="text-sm font-semibold text-slate-500">Upload photos</p>
            <p className="text-xs text-slate-400 mt-0.5">Bientôt disponible</p>
          </div>
        </AccordionSection>

        {/* ── Section 6 : Rapport & Signature ────────────────────────────── */}
        <AccordionSection
          title="Rapport & Signature"
          isOpen={open.rapport}
          onToggle={() => toggleSection('rapport')}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Observations</label>
              <textarea
                value={localObservations}
                onChange={(e) => setLocalObservations(e.target.value)}
                rows={4}
                placeholder="Travaux effectués, remarques, problèmes rencontrés…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm font-semibold text-slate-500">Signature client</p>
              <p className="text-xs text-slate-400 mt-0.5">Bientôt disponible</p>
            </div>
          </div>
        </AccordionSection>
      </div>

      {/* ── Footer fixe ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 right-0 w-full max-w-lg border-t border-slate-200 bg-white px-5 py-4 flex gap-2 justify-end flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {isSaving ? '…' : '💾 Sauvegarder'}
        </button>

        {/* Démarrer */}
        {iv.status === 'planifiee' && (
          <button
            type="button"
            onClick={() => handleStatus('en_cours')}
            disabled={isPendingStatus}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isPendingStatus ? '…' : '🚀 Démarrer'}
          </button>
        )}

        {/* Terminer */}
        {iv.status === 'en_cours' && (
          <button
            type="button"
            onClick={() => handleStatus('terminee')}
            disabled={isPendingStatus}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPendingStatus ? '…' : '✅ Terminer'}
          </button>
        )}

        {/* Envoyer rapport (uniquement quand terminée) */}
        {iv.status === 'terminee' && (
          <button
            type="button"
            onClick={handleSendReport}
            disabled={isSendingReport || reportSent}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              reportSent
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {isSendingReport ? '…' : reportSent ? '✅ Rapport envoyé' : '📧 Envoyer le rapport'}
          </button>
        )}
      </div>
    </SlideOver>
  );
}
