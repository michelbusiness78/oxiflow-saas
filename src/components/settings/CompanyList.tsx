'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Company, CompanyInput, CompanyObjective } from '@/app/actions/companies';
import { saveCompany, deleteCompany, saveCompanyObjectives } from '@/app/actions/companies';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  companies:  Company[];
  objectives: CompanyObjective[];
}

const EMPTY: CompanyInput = {
  name:                       '',
  siret:                      null,
  tva_number:                 null,
  address:                    null,
  postal_code:                null,
  city:                       null,
  phone:                      null,
  email:                      null,
  website:                    null,
  iban:                       null,
  bic:                        null,
  logo_url:                   null,
  color:                      '#2563eb',
  mention_tva:                'TVA sur encaissements',
  conditions_paiement_defaut: '30 jours fin de mois',
  pied_facture:               null,
  active:                     true,
};

const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// ─── CompanyList ──────────────────────────────────────────────────────────────

export function CompanyList({ companies, objectives }: Props) {
  const router = useRouter();
  const year   = new Date().getFullYear();

  // ── company form state ─────────────────────────────────────────────────────
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<Company | null>(null);
  const [form, setForm]           = useState<CompanyInput>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── objectives state ───────────────────────────────────────────────────────
  const [editingObj, setEditingObj] = useState(false);
  const [objDraft, setObjDraft]     = useState<Record<string, { monthly: number; annual: number }>>({});
  const [savingObj, setSavingObj]   = useState(false);
  const [objError, setObjError]     = useState<string | null>(null);

  // ── init form on panel open ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (editing) {
      setForm({
        name:                       editing.name,
        siret:                      editing.siret,
        tva_number:                 editing.tva_number,
        address:                    editing.address,
        postal_code:                editing.postal_code,
        city:                       editing.city,
        phone:                      editing.phone,
        email:                      editing.email,
        website:                    editing.website,
        iban:                       editing.iban,
        bic:                        editing.bic,
        logo_url:                   editing.logo_url,
        color:                      editing.color ?? '#2563eb',
        mention_tva:                editing.mention_tva ?? 'TVA sur encaissements',
        conditions_paiement_defaut: editing.conditions_paiement_defaut ?? '30 jours fin de mois',
        pied_facture:               editing.pied_facture,
        active:                     editing.active,
      });
    } else {
      setForm(EMPTY);
    }
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, editing]);

  // ── init objective draft on edit ───────────────────────────────────────────
  useEffect(() => {
    if (!editingObj) return;
    const draft: Record<string, { monthly: number; annual: number }> = {};
    for (const c of companies.filter((c) => c.active)) {
      const obj = objectives.find((o) => o.company_id === c.id);
      draft[c.id] = {
        monthly: obj?.monthly_target ?? 0,
        annual:  obj?.annual_target  ?? 0,
      };
    }
    setObjDraft(draft);
    setObjError(null);
  }, [editingObj, companies, objectives]);

  // ── company form handlers ──────────────────────────────────────────────────
  function openCreate()        { setEditing(null); setOpen(true); }
  function openEdit(c: Company) { setEditing(c);   setOpen(true); }
  function closePanel()        { setOpen(false); setEditing(null); }

  function setField(key: keyof CompanyInput, val: string | boolean | null) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Le nom est obligatoire.'); return; }
    setSaving(true);
    const res = await saveCompany(form, editing?.id);
    setSaving(false);
    if (res.error) { setFormError(res.error); return; }
    closePanel();
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await deleteCompany(id);
    if (res.error) { alert(res.error); return; }
    setConfirmId(null);
    router.refresh();
  }

  // ── objectives handlers ────────────────────────────────────────────────────
  function setObjField(companyId: string, field: 'monthly' | 'annual', val: string) {
    const num = parseFloat(val) || 0;
    setObjDraft((d) => ({ ...d, [companyId]: { ...d[companyId], [field]: num } }));
  }

  async function handleSaveObjectives() {
    setSavingObj(true);
    setObjError(null);
    for (const [company_id, vals] of Object.entries(objDraft)) {
      const res = await saveCompanyObjectives({
        company_id,
        year,
        monthly_target: vals.monthly,
        annual_target:  vals.annual,
      });
      if (res.error) { setObjError(res.error); setSavingObj(false); return; }
    }
    setSavingObj(false);
    setEditingObj(false);
    router.refresh();
  }

  const activeCompanies = companies.filter((c) => c.active);

  return (
    <div className="space-y-8">

      {/* ── Sociétés ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            Mes sociétés ({companies.length})
          </h2>
          <button
            type="button"
            onClick={() => { setEditing(null); setOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + Ajouter
          </button>
        </div>

        {companies.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Aucune société configurée. Cliquez sur &ldquo;+ Ajouter&rdquo; pour commencer.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <CompanyCard
                key={c.id}
                company={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setConfirmId(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Objectifs financiers ── */}
      {activeCompanies.length > 0 && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              🎯 Objectifs financiers — CA mensuel cible par société
            </h2>
            {!editingObj && (
              <button
                type="button"
                onClick={() => setEditingObj(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Modifier
              </button>
            )}
          </div>

          {!editingObj ? (
            /* Read mode */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCompanies.map((c) => {
                const obj = objectives.find((o) => o.company_id === c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? '#2563eb' }}
                      />
                      <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                    </div>
                    <div className="text-sm text-slate-700 space-y-0.5">
                      <p>
                        Mensuel :{' '}
                        <strong>{fmt(obj?.monthly_target ?? 0)}</strong>
                      </p>
                      <p>
                        Annuel :{' '}
                        <strong>{fmt(obj?.annual_target ?? 0)}</strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Edit mode */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCompanies.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color ?? '#2563eb' }}
                      />
                      <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Objectif mensuel (€)</label>
                        <input
                          type="number" min="0" step="100"
                          value={objDraft[c.id]?.monthly ?? 0}
                          onChange={(e) => setObjField(c.id, 'monthly', e.target.value)}
                          className={INPUT}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Objectif annuel (€)</label>
                        <input
                          type="number" min="0" step="1000"
                          value={objDraft[c.id]?.annual ?? 0}
                          onChange={(e) => setObjField(c.id, 'annual', e.target.value)}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {objError && <p className="text-sm text-red-600">{objError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingObj(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveObjectives}
                  disabled={savingObj}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingObj ? 'Enregistrement…' : 'Enregistrer les objectifs'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SlideOver panel (create / edit company) ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30" onClick={closePanel} />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h3 className="text-base font-semibold text-slate-800">
                {editing ? 'Modifier la société' : 'Nouvelle société'}
              </h3>
              <button onClick={closePanel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-6 p-6">

              <Section title="Identité">
                <Field label="Nom *">
                  <input ref={nameRef} value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className={INPUT} placeholder="Ma Société SAS" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SIRET">
                    <input value={form.siret ?? ''}
                      onChange={(e) => setField('siret', e.target.value || null)}
                      className={INPUT} placeholder="12345678901234" maxLength={14} />
                  </Field>
                  <Field label="N° TVA intracommunautaire">
                    <input value={form.tva_number ?? ''}
                      onChange={(e) => setField('tva_number', e.target.value || null)}
                      className={INPUT} placeholder="FR12345678901" />
                  </Field>
                </div>
                <Field label="Couleur">
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color}
                      onChange={(e) => setField('color', e.target.value)}
                      className="h-9 w-16 cursor-pointer rounded border border-slate-300 p-0.5" />
                    <span className="text-sm text-slate-500">{form.color}</span>
                  </div>
                </Field>
              </Section>

              <Section title="Coordonnées">
                <Field label="Adresse">
                  <input value={form.address ?? ''}
                    onChange={(e) => setField('address', e.target.value || null)}
                    className={INPUT} placeholder="12 rue de la Paix" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Code postal">
                    <input value={form.postal_code ?? ''}
                      onChange={(e) => setField('postal_code', e.target.value || null)}
                      className={INPUT} placeholder="75001" maxLength={10} />
                  </Field>
                  <Field label="Ville" className="col-span-2">
                    <input value={form.city ?? ''}
                      onChange={(e) => setField('city', e.target.value || null)}
                      className={INPUT} placeholder="Paris" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Téléphone">
                    <input value={form.phone ?? ''}
                      onChange={(e) => setField('phone', e.target.value || null)}
                      className={INPUT} placeholder="01 23 45 67 89" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.email ?? ''}
                      onChange={(e) => setField('email', e.target.value || null)}
                      className={INPUT} placeholder="contact@societe.fr" />
                  </Field>
                </div>
                <Field label="Site web">
                  <input value={form.website ?? ''}
                    onChange={(e) => setField('website', e.target.value || null)}
                    className={INPUT} placeholder="https://www.societe.fr" />
                </Field>
              </Section>

              <Section title="Coordonnées bancaires">
                <Field label="IBAN">
                  <input value={form.iban ?? ''}
                    onChange={(e) => setField('iban', e.target.value || null)}
                    className={INPUT} placeholder="FR76 3000 4028 3798 7654 3210 943" maxLength={34} />
                </Field>
                <Field label="BIC / SWIFT">
                  <input value={form.bic ?? ''}
                    onChange={(e) => setField('bic', e.target.value || null)}
                    className={INPUT} placeholder="BNPAFRPPXXX" maxLength={11} />
                </Field>
              </Section>

              <Section title="Facturation">
                <Field label="Mention TVA">
                  <input value={form.mention_tva}
                    onChange={(e) => setField('mention_tva', e.target.value)}
                    className={INPUT} placeholder="TVA sur encaissements" />
                </Field>
                <Field label="Conditions de paiement par défaut">
                  <input value={form.conditions_paiement_defaut}
                    onChange={(e) => setField('conditions_paiement_defaut', e.target.value)}
                    className={INPUT} placeholder="30 jours fin de mois" />
                </Field>
                <Field label="Pied de facture">
                  <textarea value={form.pied_facture ?? ''}
                    onChange={(e) => setField('pied_facture', e.target.value || null)}
                    rows={3} className={INPUT + ' resize-none'}
                    placeholder="Capital : 10 000 € — RCS Paris 123 456 789" />
                </Field>
              </Section>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.active}
                  onChange={(e) => setField('active', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-700">Société active</span>
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={closePanel}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setConfirmId(null)} />
          <div className="relative rounded-xl bg-white shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-800">Supprimer la société ?</h3>
            <p className="text-sm text-slate-600">Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CompanyCard ──────────────────────────────────────────────────────────────

function CompanyCard({
  company, onEdit, onDelete,
}: { company: Company; onEdit: () => void; onDelete: () => void }) {
  const color = company.color ?? '#2563eb';
  return (
    <div className="rounded-xl border-2 bg-white shadow-sm flex flex-col gap-3 p-4" style={{ borderColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-800 leading-snug">{company.name}</span>
        {!company.active && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>
        )}
      </div>
      {(company.email || company.phone) && (
        <div className="space-y-0.5 text-sm text-slate-600">
          {company.email && <p>{company.email}</p>}
          {company.phone && <p>{company.phone}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <InfoCell label="SIRET"   value={company.siret} />
        <InfoCell label="N° TVA"  value={company.tva_number} />
        <InfoCell label="Adresse" value={[company.address, company.postal_code, company.city].filter(Boolean).join(' ')} />
        <InfoCell label="IBAN"    value={company.iban ? `${company.iban.slice(0, 8)}…` : null} />
      </div>
      <div className="flex gap-2 pt-1 border-t border-slate-100">
        <button onClick={onEdit}
          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          Modifier
        </button>
        <button onClick={onDelete}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-slate-400">{label} </span>
      <span className="text-slate-700">{value || '—'}</span>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
