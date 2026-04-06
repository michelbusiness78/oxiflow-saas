'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  saveProjectDetail,
  createIntervention,
  getProjectInterventions,
  getProjectQuoteLines,
  getProjectDocumentsData,
} from '@/app/actions/chef-projet';
import { ProjectTasksSection } from './ProjectTasksSection';
import type {
  ProjectDetailData,
  ProjectInterventionRow,
  QuoteLigneForProject,
  ProjectDocumentsData,
} from '@/app/actions/chef-projet';
import type { ProjectTask } from '@/app/actions/project-tasks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls    = 'w-full rounded-lg border border-[#dde3f0] bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200';
const readonlyCls = 'w-full rounded-lg border border-[#dde3f0] bg-slate-50 px-3 py-2 text-sm text-slate-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#dde3f0] bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#dde3f0] bg-slate-50/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'infos' | 'planning' | 'materiel' | 'taches' | 'documents';

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos',     label: 'Infos'      },
  { key: 'planning',  label: 'Planning'   },
  { key: 'materiel',  label: 'Matériel'   },
  { key: 'taches',    label: 'Tâches'     },
  { key: 'documents', label: 'Documents'  },
];

const STATUS_COLOR: Record<string, string> = {
  planifiee: 'bg-blue-100 text-blue-700',
  en_cours:  'bg-amber-100 text-amber-700',
  terminee:  'bg-green-100 text-green-700',
  annulee:   'bg-slate-100 text-slate-500',
};
const STATUS_LABEL: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée',
};

const TYPE_LABEL: Record<string, string> = {
  installation: 'Installation', maintenance: 'Maintenance', depannage: 'Dépannage',
  formation: 'Formation', reseau: 'Réseau', securite: 'Sécurité', autre: 'Autre',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  project:  ProjectDetailData;
  tasks:    ProjectTask[];
  tenantId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectDetailFull({ project, tasks, tenantId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('infos');
  const [isSaving,  startSave]   = useTransition();
  const [saveOk,    setSaveOk]   = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Infos state ───────────────────────────────────────────────────────────────
  const [name,            setName]            = useState(project.name);
  const [description,     setDescription]     = useState(project.description ?? '');
  const [status,          setStatus]          = useState(project.status);
  const [projectType,     setProjectType]     = useState(project.type ?? 'installation');
  const [deadline,        setDeadline]        = useState(project.deadline ?? '');
  const [purchaseAmount,  setPurchaseAmount]  = useState(project.purchase_amount ?? 0);
  const [hoursSold,       setHoursSold]       = useState(project.hours_sold ?? 0);
  const [notes,           setNotes]           = useState(project.notes ?? '');
  const [reminderTime,    setReminderTime]    = useState(project.reminder_time ?? '09:00');
  const [reminderEmail,   setReminderEmail]   = useState(project.reminder_email ?? '');
  const [reminderActive,  setReminderActive]  = useState(project.reminder_active ?? false);
  // Administratif
  const [commercialName,   setCommercialName]   = useState(project.commercial_name ?? '');
  const [partner,          setPartner]          = useState(project.partner ?? '');
  const [manufacturer,     setManufacturer]     = useState(project.manufacturer ?? '');
  const [adminProjectType, setAdminProjectType] = useState(project.project_type ?? '');
  const [requestType,      setRequestType]      = useState(project.request_type ?? '');
  const [expectedDate,     setExpectedDate]     = useState(project.expected_date ?? '');
  const [expectedAmount,   setExpectedAmount]   = useState(project.expected_amount ?? 0);
  const [contractProposed, setContractProposed] = useState(project.contract_proposed ?? false);
  const [folderValidated,  setFolderValidated]  = useState(project.folder_validated ?? false);
  const [validationDate,   setValidationDate]   = useState(project.validation_date ?? '');
  const [validatedAmount,  setValidatedAmount]  = useState(project.validated_amount ?? 0);
  const [progressPercent,  setProgressPercent]  = useState(project.progress_percent ?? 0);
  const [progressNotes,    setProgressNotes]    = useState(project.progress_notes ?? '');

  // ── Matériel state ────────────────────────────────────────────────────────────
  const [materials,  setMaterials]  = useState<string[]>(project.materials ?? []);
  const [matInput,   setMatInput]   = useState('');
  const [quoteLines, setQuoteLines] = useState<QuoteLigneForProject[] | null>(null);
  const [matLoading, setMatLoading] = useState(false);

  // ── Planning state ────────────────────────────────────────────────────────────
  const [interventions,  setInterventions]  = useState<ProjectInterventionRow[] | null>(null);
  const [planLoading,    setPlanLoading]    = useState(false);
  const [showNewIntForm, setShowNewIntForm] = useState(false);
  const [newIntTitle,    setNewIntTitle]    = useState('');
  const [newIntDate,     setNewIntDate]     = useState('');
  const [newIntHours,    setNewIntHours]    = useState('');
  const [newIntType,     setNewIntType]     = useState('installation');
  const [isCreatingInt,  startCreateInt]    = useTransition();

  // ── Documents state ───────────────────────────────────────────────────────────
  const [documents,  setDocuments]  = useState<ProjectDocumentsData | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  // ── Finance helpers ────────────────────────────────────────────────────────────
  const saleHT    = project.amount_ttc / 1.2;
  const marge     = saleHT - purchaseAmount;
  const margePct  = saleHT > 0 ? Math.round((marge / saleHT) * 100) : 0;
  const margeColor = margePct >= 30 ? 'text-green-600' : margePct >= 15 ? 'text-amber-600' : 'text-red-600';

  // Heures MO (from initial project load; updated by lazy planning data)
  const hPlanified = interventions
    ? interventions.reduce((s, i) => s + (i.hours_planned ?? 0), 0)
    : project.hours_planned;
  const hSold  = hoursSold;
  const hPct   = hSold > 0 ? Math.min(100, Math.round((hPlanified / hSold) * 100)) : 0;
  const hAlert = hSold > 0 && hPlanified > hSold;
  const hWarn  = hSold > 0 && !hAlert && hPct > 80;

  // ── Lazy-load on tab change ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'planning' && interventions === null) {
      setPlanLoading(true);
      getProjectInterventions(project.id)
        .then(setInterventions)
        .finally(() => setPlanLoading(false));
    }
    if (activeTab === 'materiel' && quoteLines === null && project.quote_id) {
      setMatLoading(true);
      getProjectQuoteLines(project.quote_id)
        .then(setQuoteLines)
        .finally(() => setMatLoading(false));
    }
    if (activeTab === 'documents' && documents === null) {
      setDocLoading(true);
      getProjectDocumentsData(project.id, project.quote_id, project.client_id)
        .then(setDocuments)
        .finally(() => setDocLoading(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save (Infos + Matériel) ───────────────────────────────────────────────────

  function handleSave() {
    setSaveOk(false);
    setSaveError('');
    startSave(async () => {
      const res = await saveProjectDetail(project.id, tenantId, {
        name,
        description:       description || null,
        status,
        deadline:          deadline || null,
        type:              projectType || null,
        notes:             notes || null,
        purchase_amount:   purchaseAmount || null,
        hours_sold:        hoursSold || null,
        materials,
        reminder_time:     reminderTime || null,
        reminder_email:    reminderEmail || null,
        reminder_active:   reminderActive,
        commercial_name:   commercialName || null,
        partner:           partner || null,
        manufacturer:      manufacturer || null,
        project_type:      adminProjectType || null,
        request_type:      requestType || null,
        expected_date:     expectedDate || null,
        expected_amount:   expectedAmount || null,
        contract_proposed: contractProposed,
        folder_validated:  folderValidated,
        validation_date:   validationDate || null,
        validated_amount:  validatedAmount || null,
        progress_percent:  progressPercent,
        progress_notes:    progressNotes || null,
      });
      if (res.error) { setSaveError(res.error); return; }
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    });
  }

  // ── New intervention ──────────────────────────────────────────────────────────

  function handleCreateIntervention() {
    if (!newIntTitle.trim() || !newIntDate) return;
    startCreateInt(async () => {
      const res = await createIntervention({
        title:             newIntTitle.trim(),
        date_start:        `${newIntDate}T08:00:00`,
        project_id:        project.id,
        client_id:         project.client_id ?? undefined,
        hours_planned:     newIntHours ? parseFloat(newIntHours) : undefined,
        type_intervention: newIntType,
        nature:            'projet',
        status:            'planifiee',
      });
      if (!res.error) {
        const newRow: ProjectInterventionRow = {
          id:                res.id ?? crypto.randomUUID(),
          title:             newIntTitle.trim(),
          date_start:        `${newIntDate}T08:00:00`,
          status:            'planifiee',
          tech_name:         null,
          hours_planned:     newIntHours ? parseFloat(newIntHours) : null,
          type_intervention: newIntType,
        };
        setInterventions((prev) => [newRow, ...(prev ?? [])]);
        setNewIntTitle('');
        setNewIntDate('');
        setNewIntHours('');
        setShowNewIntForm(false);
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  // KPIs planning
  const intByStatus = (interventions ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const tasksDone  = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;

  return (
    <div className="space-y-4 pb-28">

      {/* ── En-tête ── */}
      <div className="flex items-start gap-3">
        <Link
          href="/chef-projet?tab=projets"
          className="mt-0.5 shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          aria-label="Retour"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-800 truncate">{project.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {project.affair_number && <span className="font-mono">{project.affair_number} · </span>}
            {project.client_nom}
          </p>
        </div>
        {/* Progress pill */}
        <div className="shrink-0 text-right">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            progressPercent >= 80 ? 'bg-green-100 text-green-700' :
            progressPercent >= 40 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* ── Feedback ── */}
      {saveOk && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium">
          ✓ Enregistré
        </div>
      )}
      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* ── Tab navigation ── */}
      <div className="-mx-1 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex gap-1.5 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {tab.key === 'taches' && tasksTotal > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
                }`}>
                  {tasksDone}/{tasksTotal}
                </span>
              )}
              {tab.key === 'planning' && interventions !== null && interventions.length > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
                }`}>
                  {interventions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 1 — INFOS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'infos' && (
        <div className="space-y-4">

          {/* Identité */}
          <SectionCard title="Identité du projet">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nom du projet">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Statut">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="nouveau">En attente</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                  <option value="annule">Annulé</option>
                </select>
              </Field>
              <Field label="Type">
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={inputCls}>
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="vente">Vente / Devis</option>
                </select>
              </Field>
              <Field label="N° Affaire">
                <input type="text" readOnly value={project.affair_number ?? '—'} className={readonlyCls} />
              </Field>
              <Field label="N° Devis">
                <input type="text" readOnly value={project.quote_number ?? '—'} className={readonlyCls} />
              </Field>
              <Field label="Échéance">
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Date prévisionnelle">
                <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description courte..." className={inputCls} />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Client */}
          <SectionCard title="Client">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-400 mb-0.5">Société</p>
                <p className="font-semibold text-slate-800">{project.client_nom}</p>
                {project.client_adresse && (
                  <p className="text-slate-500 text-xs mt-0.5">
                    {[project.client_adresse, project.client_ville].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {project.client_contact && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Contact</p>
                  <p className="text-slate-600">{project.client_contact}</p>
                </div>
              )}
              {project.client_tel && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Téléphone</p>
                  <a href={`tel:${project.client_tel}`} className="text-blue-600 hover:underline">{project.client_tel}</a>
                </div>
              )}
              {project.client_email && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Email</p>
                  <a href={`mailto:${project.client_email}`} className="text-blue-600 hover:underline">{project.client_email}</a>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Commercial & partenaires */}
          <SectionCard title="Commercial & Partenaires">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Commercial">
                <input type="text" value={commercialName} onChange={(e) => setCommercialName(e.target.value)} placeholder="Nom du commercial" className={inputCls} />
              </Field>
              <Field label="Partenaire">
                <input type="text" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Partenaire" className={inputCls} />
              </Field>
              <Field label="Constructeur / Marque">
                <input type="text" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Ex: Schneider, Legrand…" className={inputCls} />
              </Field>
              <Field label="Type de projet">
                <select value={adminProjectType} onChange={(e) => setAdminProjectType(e.target.value)} className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  <option value="courant_fort">Courant fort</option>
                  <option value="courant_faible">Courant faible</option>
                  <option value="photovoltaique">Photovoltaïque</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="autre">Autre</option>
                </select>
              </Field>
              <Field label="Type de demande">
                <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={inputCls}>
                  <option value="">— Sélectionner —</option>
                  <option value="neuf">Travaux neufs</option>
                  <option value="extension">Extension</option>
                  <option value="renovation">Rénovation</option>
                  <option value="maintenance">Remplacement</option>
                </select>
              </Field>
            </div>
          </SectionCard>

          {/* Financier */}
          <SectionCard title="Financier">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Montant devis TTC (€)">
                <input type="text" readOnly value={fmtEur(project.amount_ttc)} className={readonlyCls} />
              </Field>
              <Field label="Montant HT prévisionnel (€)">
                <input type="number" min={0} step={100} value={expectedAmount || ''} onChange={(e) => setExpectedAmount(parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls} />
              </Field>
              <Field label="Achat HT (€)">
                <input type="number" min={0} step={100} value={purchaseAmount || ''} onChange={(e) => setPurchaseAmount(parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls} />
              </Field>
            </div>
            <div className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold ${
              margePct >= 30 ? 'bg-green-50 border border-green-200' :
              margePct >= 15 ? 'bg-amber-50 border border-amber-200' :
                               'bg-red-50 border border-red-200'
            }`}>
              <span className="text-slate-600 font-normal">Marge estimée : </span>
              <span className={margeColor}>
                {fmtEur(saleHT)} − {fmtEur(purchaseAmount)} = {fmtEur(marge)} · {margePct}%
              </span>
            </div>
          </SectionCard>

          {/* Contrat & Dossier */}
          <SectionCard title="Contrat & Dossier">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setContractProposed((v) => !v)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    contractProposed ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {contractProposed ? '✅ Contrat proposé' : '☐ Contrat proposé'}
                </button>
                <button
                  type="button"
                  onClick={() => setFolderValidated((v) => !v)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    folderValidated ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {folderValidated ? '📁 Dossier validé' : '📁 Dossier non validé'}
                </button>
              </div>
              {folderValidated && (
                <>
                  <Field label="Date de validation">
                    <input type="date" value={validationDate} onChange={(e) => setValidationDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Montant HT validé (€)">
                    <input type="number" min={0} step={100} value={validatedAmount || ''} onChange={(e) => setValidatedAmount(parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls} />
                  </Field>
                </>
              )}
            </div>
          </SectionCard>

          {/* Avancement */}
          <SectionCard title="Avancement">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progression</label>
                  <span className={`text-sm font-bold ${
                    progressPercent >= 80 ? 'text-green-600' : progressPercent >= 40 ? 'text-blue-600' : 'text-amber-600'
                  }`}>{progressPercent}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
                <div className="h-2 rounded-full bg-[#dde3f0] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPercent >= 80 ? 'bg-green-500' : progressPercent >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <Field label="Notes d'avancement">
                <textarea
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  rows={3}
                  placeholder="Commentaires sur l'avancement…"
                  className={`${inputCls} resize-y min-h-[72px]`}
                />
              </Field>
            </div>
          </SectionCard>

          {/* Notes */}
          <SectionCard title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes, informations importantes..."
              className={`${inputCls} resize-y min-h-[96px]`}
            />
          </SectionCard>

          {/* Rappel */}
          <SectionCard title="Rappel automatique">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Heure">
                  <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Email">
                  <input type="email" value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} placeholder="email@exemple.com" className={inputCls} />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setReminderActive((v) => !v)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  reminderActive ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {reminderActive ? '🔔 Activé' : '🔕 Désactivé'}
              </button>
            </div>
          </SectionCard>

          {/* Bouton Enregistrer dans l'onglet */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 2 — PLANNING
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planning' && (
        <div className="space-y-4">

          {/* KPIs */}
          {interventions !== null && interventions.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Planifiées', key: 'planifiee', color: 'text-blue-600' },
                { label: 'En cours',   key: 'en_cours',  color: 'text-amber-600' },
                { label: 'Terminées',  key: 'terminee',  color: 'text-green-600' },
              ].map((s) => (
                <div key={s.key} className="rounded-xl border border-[#dde3f0] bg-white shadow-sm p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{intByStatus[s.key] ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bouton + Nouvelle intervention */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Interventions du projet</h2>
            <button
              type="button"
              onClick={() => setShowNewIntForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
              </svg>
              Nouvelle
            </button>
          </div>

          {/* Formulaire inline nouvelle intervention */}
          {showNewIntForm && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Nouvelle intervention</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Titre *">
                    <input
                      type="text"
                      value={newIntTitle}
                      onChange={(e) => setNewIntTitle(e.target.value)}
                      placeholder="Ex: Pose tableau électrique"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Date *">
                  <input type="date" value={newIntDate} onChange={(e) => setNewIntDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Heures prévues">
                  <input type="number" min={0} step={0.5} value={newIntHours} onChange={(e) => setNewIntHours(e.target.value)} placeholder="0" className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Type">
                    <select value={newIntType} onChange={(e) => setNewIntType(e.target.value)} className={inputCls}>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="depannage">Dépannage</option>
                      <option value="formation">Formation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateIntervention}
                  disabled={!newIntTitle.trim() || !newIntDate || isCreatingInt}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isCreatingInt ? 'Création…' : 'Créer l\'intervention'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewIntForm(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Liste interventions */}
          {planLoading && <Spinner />}

          {!planLoading && interventions !== null && interventions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-sm text-slate-400">Aucune intervention pour ce projet.</p>
              <p className="text-xs text-slate-300 mt-1">Cliquez "+ Nouvelle" pour en créer une.</p>
            </div>
          )}

          {!planLoading && interventions !== null && interventions.length > 0 && (
            <div className="space-y-2">
              {interventions.map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 rounded-xl border border-[#dde3f0] bg-white px-4 py-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{iv.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(iv.date_start)}
                      {iv.tech_name && <span> · {iv.tech_name}</span>}
                      {iv.hours_planned && <span> · {iv.hours_planned}h</span>}
                      {iv.type_intervention && <span> · {TYPE_LABEL[iv.type_intervention] ?? iv.type_intervention}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[iv.status] ?? STATUS_COLOR.planifiee}`}>
                    {STATUS_LABEL[iv.status] ?? iv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 3 — MATÉRIEL
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'materiel' && (
        <div className="space-y-4">

          {/* A) Matériel du devis */}
          <SectionCard title="Matériel du devis (référence)">
            {!project.quote_id && (
              <p className="text-sm text-slate-400 italic">Aucun devis lié à ce projet.</p>
            )}
            {project.quote_id && matLoading && <Spinner />}
            {project.quote_id && !matLoading && (quoteLines === null || quoteLines.length === 0) && (
              <p className="text-sm text-slate-400 italic">Aucune ligne matériel dans le devis.</p>
            )}
            {project.quote_id && !matLoading && quoteLines !== null && quoteLines.length > 0 && (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-[#dde3f0]">
                      <th className="pb-2 text-left">Désignation</th>
                      <th className="pb-2 text-center w-16">Qté</th>
                      <th className="pb-2 text-right w-24">PU HT</th>
                      <th className="pb-2 text-right w-24">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dde3f0]">
                    {quoteLines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-800">{l.designation}</p>
                          {l.reference && <p className="text-xs text-slate-400 font-mono">{l.reference}</p>}
                        </td>
                        <td className="py-2 text-center text-slate-600">{l.quantite}</td>
                        <td className="py-2 text-right text-slate-600">{fmtEur(l.prix_unitaire)}</td>
                        <td className="py-2 text-right font-semibold text-slate-800">{fmtEur(l.total_ht)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#dde3f0]">
                      <td colSpan={3} className="pt-2 text-xs font-semibold uppercase text-slate-500 text-right pr-3">Total HT</td>
                      <td className="pt-2 text-right font-bold text-slate-800">
                        {fmtEur(quoteLines.reduce((s, l) => s + l.total_ht, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionCard>

          {/* B) Matériel manuel */}
          <SectionCard title="Matériel ajouté manuellement">
            <div className="space-y-3">
              <div className="space-y-2">
                {materials.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Aucun matériel ajouté.</p>
                )}
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[#dde3f0] bg-white px-3 py-2">
                    <span className="text-sm text-slate-700">{m}</span>
                    <button
                      type="button"
                      onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-red-500 transition-colors ml-2"
                      aria-label="Supprimer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={matInput}
                  onChange={(e) => setMatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { const t = matInput.trim(); if (t) { setMaterials((p) => [...p, t]); setMatInput(''); } } }}
                  placeholder="Ex: Switch 48p · REF-XXX · Qté : 2"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => { const t = matInput.trim(); if (t) { setMaterials((p) => [...p, t]); setMatInput(''); } }}
                  disabled={!matInput.trim()}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </SectionCard>

          {/* C) Indicateur heures MO */}
          <SectionCard title="Heures main d'œuvre">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Heures vendues">
                <input
                  type="number" min={0} step={0.5}
                  value={hoursSold || ''}
                  onChange={(e) => setHoursSold(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label="Heures planifiées">
                <input type="text" readOnly value={hPlanified > 0 ? `${hPlanified}h` : '—'} className={readonlyCls} />
              </Field>
            </div>
            {hSold > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Planifiées / Vendues</span>
                  <span className={`font-semibold ${hAlert ? 'text-red-600' : hWarn ? 'text-amber-600' : 'text-slate-700'}`}>
                    {hPlanified}h / {hSold}h ({hPct}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#dde3f0] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${hAlert ? 'bg-red-500' : hWarn ? 'bg-amber-500' : 'bg-blue-600'}`}
                    style={{ width: `${hPct}%` }}
                  />
                </div>
                {hAlert && (
                  <p className="text-xs font-semibold text-red-600">
                    ⚠ Dépassement de {Math.round((hPlanified - hSold) * 10) / 10}h
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Saisissez les heures vendues pour activer le suivi.</p>
            )}
          </SectionCard>

          {/* Enregistrer matériel + heures */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 4 — TÂCHES
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'taches' && (
        <div className="space-y-4">
          <SectionCard title="Tâches du projet">
            <ProjectTasksSection
              initialTasks={tasks}
              projectId={project.id}
              tenantId={tenantId}
            />
          </SectionCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 5 — DOCUMENTS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {docLoading && <Spinner />}

          {!docLoading && documents !== null && (
            <>
              {/* Devis source */}
              <SectionCard title="Devis source">
                {!documents.quote ? (
                  <p className="text-sm text-slate-400 italic">Aucun devis lié.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-800">{documents.quote.number}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(documents.quote.date)} · {fmtEur(documents.quote.montant_ttc)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        documents.quote.statut === 'accepte' ? 'bg-green-100 text-green-700' :
                        documents.quote.statut === 'refuse'  ? 'bg-red-100 text-red-700' :
                        documents.quote.statut === 'envoye'  ? 'bg-blue-100 text-blue-700' :
                                                               'bg-slate-100 text-slate-600'
                      }`}>
                        {documents.quote.statut}
                      </span>
                      <a
                        href={`/api/pdf/devis/${documents.quote.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Voir PDF
                      </a>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Factures liées */}
              <SectionCard title="Factures liées">
                {documents.invoices.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucune facture émise.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#dde3f0] last:border-0">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-800">{inv.number}</p>
                          <p className="text-xs text-slate-400">{fmtDate(inv.date_facture)} · {fmtEur(inv.total_ttc)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            inv.status === 'payee'    ? 'bg-green-100 text-green-700' :
                            inv.status === 'en_retard'? 'bg-red-100 text-red-700' :
                            inv.status === 'emise'    ? 'bg-blue-100 text-blue-700' :
                                                        'bg-slate-100 text-slate-600'
                          }`}>
                            {inv.status === 'payee' ? 'Payée' : inv.status === 'emise' ? 'Émise' : inv.status === 'en_retard' ? 'En retard' : inv.status}
                          </span>
                          <a
                            href={`/api/pdf/facture/${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Voir PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Contrats liés */}
              <SectionCard title="Contrats client">
                {documents.contrats.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucun contrat pour ce client.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.contrats.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#dde3f0] last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 capitalize">{c.type}</p>
                          <p className="text-xs text-slate-400">
                            {fmtDate(c.date_debut)}{c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ''}
                            {c.montant_mensuel ? ` · ${fmtEur(c.montant_mensuel)}/mois` : ''}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {c.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* État vide global */}
              {!documents.quote && documents.invoices.length === 0 && documents.contrats.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
                  <p className="text-slate-400 text-sm">Aucun document lié à ce projet.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
