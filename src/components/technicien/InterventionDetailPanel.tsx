'use client';

import { useState, useEffect, useTransition } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import {
  updateInterventionStatus,
  saveInterventionProgress,
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
  const [error,           setError]              = useState('');

  // État local des sections accordéon
  const [open, setOpen] = useState({
    infos: true, pointage: false, checklist: false, materiaux: false, photos: false, rapport: false,
  });

  // État local du contenu éditable
  const [localHourStart,    setLocalHourStart]    = useState('');
  const [localHourEnd,      setLocalHourEnd]      = useState('');
  const [localChecklist,    setLocalChecklist]    = useState<ChecklistItem[]>([]);
  const [localMaterials,    setLocalMaterials]    = useState<MaterialItem[]>([]);
  const [localObservations, setLocalObservations] = useState('');
  const [newTaskLabel,      setNewTaskLabel]      = useState('');
  const [showMatForm,       setShowMatForm]       = useState(false);
  const [newMat, setNewMat] = useState({ type: '', marque: '', modele: '', serial: '', location: '' });

  // Reset quand l'intervention change
  useEffect(() => {
    if (!intervention) return;
    setLocalHourStart(intervention.hour_start   ?? '');
    setLocalHourEnd(intervention.hour_end       ?? '');
    setLocalChecklist(intervention.checklist    ?? []);
    setLocalMaterials(intervention.materials_installed ?? []);
    setLocalObservations(intervention.observations ?? '');
    setError('');
    setOpen({ infos: true, pointage: false, checklist: false, materiaux: false, photos: false, rapport: false });
  }, [intervention?.id]);

  if (!intervention) return null;
  const iv = intervention; // local const — narrows type for closures

  const cfg        = STATUS_CFG[iv.status] ?? { label: iv.status, cls: 'bg-slate-100 text-slate-500' };
  const clientNom  = iv.client_name   ?? iv.clients?.nom    ?? null;
  const clientAddr = iv.client_address ?? iv.clients?.adresse ?? null;
  const clientCity = iv.client_city   ?? iv.clients?.ville  ?? null;
  const clientTel  = iv.client_phone  ?? iv.clients?.tel    ?? null;
  const fullAddr   = [clientAddr, clientCity].filter(Boolean).join(', ');

  // ── Handlers ────────────────────────────────────────────────────────────────

  function toggleSection(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleChecklistToggle(itemId: string) {
    const updated = localChecklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
    setLocalChecklist(updated);
    // Auto-save checklist
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

  function handleAddMaterial() {
    if (!newMat.type && !newMat.marque) return;
    const updated = [...localMaterials, { id: crypto.randomUUID(), ...newMat }];
    setLocalMaterials(updated);
    setNewMat({ type: '', marque: '', modele: '', serial: '', location: '' });
    setShowMatForm(false);
  }

  function handleRemoveMaterial(id: string) {
    setLocalMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSave() {
    setIsSaving(true);
    setError('');
    const updates = {
      hour_start:          localHourStart  || null,
      hour_end:            localHourEnd    || null,
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
    startStatusTransition(async () => {
      const res = await updateInterventionStatus(iv.id, newStatus);
      if (res.error) { setError(res.error); return; }
      onStatusChange(iv.id, newStatus);
    });
  }

  const checkDone  = localChecklist.filter((c) => c.done).length;
  const checkTotal = localChecklist.length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SlideOver open={!!intervention} onClose={onClose} title="Fiche intervention" width="lg">
      <div className="pb-28">
        {error && (
          <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Titre + badge */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 flex-1">{iv.title}</h3>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
          {iv.nature === 'sav' && (
            <span className="rounded-full bg-yellow-100 px-3 py-0.5 text-xs font-semibold text-yellow-700">
              ⚠ SAV
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
            {/* Date */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Date</p>
              <p className="text-sm text-slate-800">{fmtDateTime(iv.date_start)}</p>
              {iv.date_end && (
                <p className="text-xs text-slate-400 mt-0.5">→ {fmtDateTime(iv.date_end)}</p>
              )}
            </div>

            {/* Type intervention */}
            {iv.type_intervention && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Type</p>
                <p className="text-sm text-slate-800">
                  {TYPE_INT_LABELS[iv.type_intervention] ?? iv.type_intervention}
                </p>
              </div>
            )}

            {/* Heures prévues */}
            {iv.hours_planned != null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Heures prévues</p>
                <p className="text-sm text-slate-800">{iv.hours_planned}h</p>
              </div>
            )}

            {/* Client */}
            {clientNom && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Client</p>
                <p className="text-sm font-semibold text-slate-800">{clientNom}</p>
                {fullAddr && <p className="text-xs text-slate-500 mt-0.5">📍 {fullAddr}</p>}
                {clientTel && <p className="text-xs text-slate-500 mt-0.5">📞 {clientTel}</p>}
              </div>
            )}

            {/* Boutons rapides */}
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

            {/* Notes */}
            {iv.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{iv.notes}</p>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* ── Section 2 : Pointage heures ─────────────────────────────────── */}
        <AccordionSection
          title="Pointage heures"
          isOpen={open.pointage}
          onToggle={() => toggleSection('pointage')}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Heure début</label>
              <input
                type="time"
                value={localHourStart}
                onChange={(e) => setLocalHourStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Heure fin</label>
              <input
                type="time"
                value={localHourEnd}
                onChange={(e) => setLocalHourEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          {iv.hours_planned != null && (
            <p className="mt-2 text-xs text-slate-400">Heures prévues : {iv.hours_planned}h</p>
          )}
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

            {/* Ajouter une tâche */}
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

            {localMaterials.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">{m.marque} {m.modele}</p>
                    {m.type     && <p className="text-slate-500">Type : {m.type}</p>}
                    {m.serial   && <p className="text-slate-500">N° série : {m.serial}</p>}
                    {m.location && <p className="text-slate-500">Local. : {m.location}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(m.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {showMatForm ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                {(['type', 'marque', 'modele', 'serial', 'location'] as const).map((field) => (
                  <input
                    key={field}
                    type="text"
                    value={newMat[field]}
                    onChange={(e) => setNewMat((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={{
                      type: 'Type (ex: Switch, ONT…)',
                      marque: 'Marque',
                      modele: 'Modèle',
                      serial: 'N° série',
                      location: 'Localisation',
                    }[field]}
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
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
      </div>
    </SlideOver>
  );
}
