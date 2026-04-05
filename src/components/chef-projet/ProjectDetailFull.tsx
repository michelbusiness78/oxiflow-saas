'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { saveProjectDetail } from '@/app/actions/chef-projet';
import { ProjectTasksSection } from './ProjectTasksSection';
import type { ProjectDetailData } from '@/app/actions/chef-projet';
import type { ProjectTask } from '@/app/actions/project-tasks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#dde3f0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#dde3f0] bg-slate-50/60">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-[#dde3f0] bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200';
const readonlyCls = 'w-full rounded-lg border border-[#dde3f0] bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  project:  ProjectDetailData;
  tasks:    ProjectTask[];
  tenantId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectDetailFull({ project, tasks, tenantId }: Props) {
  const [isSaving,   startSave]  = useTransition();
  const [saveOk,     setSaveOk]  = useState(false);
  const [saveError,  setSaveError] = useState('');

  // Editable state
  const [name,             setName]             = useState(project.name);
  const [description,      setDescription]      = useState(project.description ?? '');
  const [status,           setStatus]           = useState(project.status);
  const [projectType,      setProjectType]      = useState(project.type ?? 'installation');
  const [deadline,         setDeadline]         = useState(project.deadline ?? '');
  const [purchaseAmount,   setPurchaseAmount]   = useState(project.purchase_amount ?? 0);
  const [hoursSold,        setHoursSold]        = useState(project.hours_sold ?? 0);
  const [installerName,    setInstallerName]    = useState(project.installer_name ?? '');
  const [installerRef,     setInstallerRef]     = useState(project.installer_ref ?? '');
  const [installerContact, setInstallerContact] = useState(project.installer_contact ?? '');
  const [supplierName,     setSupplierName]     = useState(project.supplier_name ?? '');
  const [materials,        setMaterials]        = useState<string[]>(project.materials ?? []);
  const [matInput,         setMatInput]         = useState('');
  const [notes,            setNotes]            = useState(project.notes ?? buildDefaultNotes(project));
  const [reminderTime,     setReminderTime]     = useState(project.reminder_time ?? '09:00');
  const [reminderEmail,    setReminderEmail]    = useState(project.reminder_email ?? '');
  const [reminderActive,   setReminderActive]   = useState(project.reminder_active ?? false);

  // Administratif
  const [commercialName,    setCommercialName]    = useState(project.commercial_name ?? '');
  const [partner,           setPartner]           = useState(project.partner ?? '');
  const [manufacturer,      setManufacturer]      = useState(project.manufacturer ?? '');
  const [adminProjectType,  setAdminProjectType]  = useState(project.project_type ?? '');
  const [requestType,       setRequestType]       = useState(project.request_type ?? '');
  const [expectedDate,      setExpectedDate]      = useState(project.expected_date ?? '');
  const [expectedAmount,    setExpectedAmount]    = useState(project.expected_amount ?? 0);
  const [contractProposed,  setContractProposed]  = useState(project.contract_proposed ?? false);
  const [folderValidated,   setFolderValidated]   = useState(project.folder_validated ?? false);
  const [validationDate,    setValidationDate]    = useState(project.validation_date ?? '');
  const [validatedAmount,   setValidatedAmount]   = useState(project.validated_amount ?? 0);
  const [progressPercent,   setProgressPercent]   = useState(project.progress_percent ?? 0);
  const [progressNotes,     setProgressNotes]     = useState(project.progress_notes ?? '');

  // Finances
  const saleHT   = project.amount_ttc / 1.2;  // approx HT (TTC / 1.20)
  const marge     = saleHT - purchaseAmount;
  const margePct  = saleHT > 0 ? Math.round((marge / saleHT) * 100) : 0;
  const margeColor = margePct >= 30 ? 'text-green-600' : margePct >= 15 ? 'text-amber-600' : 'text-red-600';

  // Heures
  const hPlanified = project.hours_planned;
  const hSold      = hoursSold;
  const hPct       = hSold > 0 ? Math.min(100, Math.round((hPlanified / hSold) * 100)) : 0;
  const hAlert     = hSold > 0 && hPlanified > hSold;
  const hWarn      = hSold > 0 && !hAlert && hPct > 80;

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
        installer_name:    installerName || null,
        installer_ref:     installerRef || null,
        installer_contact: installerContact || null,
        supplier_name:     supplierName || null,
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

  function addMaterial() {
    const t = matInput.trim();
    if (t && !materials.includes(t)) setMaterials((prev) => [...prev, t]);
    setMatInput('');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-24">
      {/* Retour */}
      <Link
        href="/chef-projet"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Retour aux projets
      </Link>

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-800 truncate">{project.name}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{project.affair_number ?? ''}</p>
        </div>
      </div>

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

      {/* ── 1. GÉNÉRAL ──────────────────────────────────────────────────────── */}
      <Section title="Général">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Type">
            <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={inputCls}>
              <option value="installation">Installation</option>
              <option value="maintenance">Maintenance</option>
              <option value="vente">Vente / Devis</option>
            </select>
          </Field>

          <Field label="Statut">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="nouveau">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="annule">Annulé</option>
            </select>
          </Field>

          <Field label="Nom du projet">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Échéance">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
          </Field>

          <Field label="N° Affaire">
            <input type="text" readOnly value={project.affair_number ?? '—'} className={readonlyCls} />
          </Field>

          <Field label="N° Devis">
            <input type="text" readOnly value={project.quote_number ?? '—'} className={readonlyCls} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du projet..."
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── 2. FINANCIER ────────────────────────────────────────────────────── */}
      <Section title="Financier">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Devis TTC (€)">
            <input type="text" readOnly value={fmtEur(project.amount_ttc)} className={readonlyCls} />
          </Field>
          <Field label="Achat HT (€)">
            <input
              type="number"
              min={0}
              step={100}
              value={purchaseAmount || ''}
              onChange={(e) => setPurchaseAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={inputCls}
            />
          </Field>
        </div>
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-semibold ${
          margePct >= 30 ? 'bg-green-50 border border-green-200' :
          margePct >= 15 ? 'bg-amber-50 border border-amber-200' :
                           'bg-red-50 border border-red-200'
        }`}>
          <span className="text-slate-600 font-normal">Marge : </span>
          <span className={margeColor}>
            {fmtEur(saleHT)} − {fmtEur(purchaseAmount)} = {fmtEur(marge)} · {margePct}%
          </span>
        </div>
      </Section>

      {/* ── 3. HEURES MAIN D'ŒUVRE ──────────────────────────────────────────── */}
      <Section title="Heures main d'œuvre">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Heures vendues">
            <input
              type="number"
              min={0}
              step={0.5}
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
          <p className="text-xs text-slate-400 italic">
            Saisissez les heures vendues pour activer le suivi
          </p>
        )}
      </Section>

      {/* ── 4. CLIENT ───────────────────────────────────────────────────────── */}
      <Section title="Client">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-400 mb-0.5">Société</p>
            <p className="font-semibold text-slate-800">{project.client_nom}</p>
          </div>
          {project.client_adresse && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-0.5">Adresse</p>
              <p className="text-slate-600">{[project.client_adresse, project.client_ville].filter(Boolean).join(', ')}</p>
            </div>
          )}
          {project.client_contact && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Contact</p>
              <p className="text-slate-600">{project.client_contact}</p>
            </div>
          )}
          {project.client_tel && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Téléphone</p>
              <a href={`tel:${project.client_tel}`} className="text-blue-600 hover:underline">
                {project.client_tel}
              </a>
            </div>
          )}
          {project.client_email && (
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400 mb-0.5">Email</p>
              <a href={`mailto:${project.client_email}`} className="text-blue-600 hover:underline">
                {project.client_email}
              </a>
            </div>
          )}
        </div>
      </Section>

      {/* ── 5. INSTALLATEUR ─────────────────────────────────────────────────── */}
      <Section title="Installateur">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Société installateur">
              <input type="text" value={installerName} onChange={(e) => setInstallerName(e.target.value)} placeholder="Nom de l'installateur" className={inputCls} />
            </Field>
          </div>
          <Field label="Réf. commande">
            <input type="text" value={installerRef} onChange={(e) => setInstallerRef(e.target.value)} placeholder="REF-2026-001" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Contact">
            <input type="text" value={installerContact} onChange={(e) => setInstallerContact(e.target.value)} placeholder="Nom du contact" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Fournisseur">
              <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nom du fournisseur" className={inputCls} />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── 6. MATÉRIEL ─────────────────────────────────────────────────────── */}
      <Section title="Matériel">
        <div className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {/* Matériel issu du devis — non supprimable */}
            {project.quote_materials.map((m) => (
              <span
                key={`devis-${m}`}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600"
                title="Matériel issu du devis"
              >
                📋 {m}
              </span>
            ))}
            {/* Matériel manuel — supprimable */}
            {materials.map((m) => (
              <span
                key={m}
                className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700"
              >
                {m}
                <button
                  type="button"
                  onClick={() => setMaterials((prev) => prev.filter((x) => x !== m))}
                  className="text-blue-400 hover:text-red-500 transition-colors"
                  aria-label={`Supprimer ${m}`}
                >
                  ×
                </button>
              </span>
            ))}
            {project.quote_materials.length === 0 && materials.length === 0 && (
              <p className="text-xs text-slate-400 italic">Aucun matériel ajouté</p>
            )}
          </div>
          {/* Input ajout */}
          <div className="flex gap-2">
            <input
              type="text"
              value={matInput}
              onChange={(e) => setMatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMaterial()}
              placeholder="Ex: Switch 48p"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={addMaterial}
              disabled={!matInput.trim()}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              + Ajouter
            </button>
          </div>
        </div>
      </Section>

      {/* ── 7. TÂCHES ───────────────────────────────────────────────────────── */}
      <Section title="Tâches ⭐">
        <ProjectTasksSection
          initialTasks={tasks}
          projectId={project.id}
          tenantId={tenantId}
        />
      </Section>

      {/* ── 8. ADMINISTRATIF ────────────────────────────────────────────────── */}
      <Section title="Informations administratives">
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
              <option value="neuf">Neuf</option>
              <option value="renovation">Rénovation</option>
              <option value="extension">Extension</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </Field>

          <Field label="Date prévisionnelle">
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Montant HT prévisionnel (€)">
            <input type="number" min={0} step={100} value={expectedAmount || ''} onChange={(e) => setExpectedAmount(parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls} />
          </Field>

          <div className="sm:col-span-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setContractProposed((v) => !v)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                contractProposed
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {contractProposed ? '✅ Contrat proposé' : '☐ Contrat proposé'}
            </button>

            <button
              type="button"
              onClick={() => setFolderValidated((v) => !v)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                folderValidated
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {folderValidated ? '📁 Dossier validé' : '📁 Dossier non validé'}
            </button>
          </div>

          <Field label="Date de validation">
            <input type="date" value={validationDate} onChange={(e) => setValidationDate(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Montant HT validé (€)">
            <input type="number" min={0} step={100} value={validatedAmount || ''} onChange={(e) => setValidatedAmount(parseFloat(e.target.value) || 0)} placeholder="0" className={inputCls} />
          </Field>

          <div className="sm:col-span-2 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avancement <span className="text-blue-600 font-bold">{progressPercent}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
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

          <div className="sm:col-span-2">
            <Field label="Notes d'avancement">
              <textarea
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                rows={3}
                placeholder="Commentaires sur l'avancement du projet…"
                className={`${inputCls} resize-y min-h-[72px]`}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── 9. NOTES ────────────────────────────────────────────────────────── */}
      <Section title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Notes, avancement, informations importantes..."
          className={`${inputCls} resize-y min-h-[96px]`}
        />
      </Section>

      {/* ── 10. RAPPEL AUTOMATIQUE ───────────────────────────────────────────── */}
      <Section title="Rappel automatique">
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
              reminderActive
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {reminderActive ? '🔔 Activé' : '🔕 Désactivé'}
          </button>
          {reminderActive && reminderEmail && (
            <p className="text-xs text-slate-500">
              Email à {reminderTime || '09:00'} → {reminderEmail}
            </p>
          )}
        </div>
      </Section>

      {/* ── Footer fixe ─────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#dde3f0] bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Link
          href="/chef-projet"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </Link>
        <span className="text-slate-200">|</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="ml-auto rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Enregistrement…' : '💾 Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultNotes(project: ProjectDetailData): string {
  if (project.notes) return project.notes;
  const parts: string[] = [];
  if (project.quote_number) parts.push(`Devis : ${project.quote_number}`);
  if (project.client_nom && project.client_nom !== '—') parts.push(`Client : ${project.client_nom}`);
  if (project.amount_ttc) {
    parts.push(`Montant TTC : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(project.amount_ttc)}`);
  }
  return parts.join(' / ');
}
