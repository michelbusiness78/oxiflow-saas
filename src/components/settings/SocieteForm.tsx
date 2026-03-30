'use client';

import { useRef, useState, useTransition } from 'react';
import { updateSocieteAction, uploadLogoAction, type SocieteInput } from '@/app/actions/settings';

interface Tenant {
  name:                string;
  siret:               string | null;
  tva_intra:           string | null;
  address:             string | null;
  cp:                  string | null;
  ville:               string | null;
  phone:               string | null;
  email:               string | null;
  logo_url:            string | null;
  iban:                string | null;
  bic:                 string | null;
  conditions_paiement: string | null;
  mentions_legales:    string | null;
}

interface Props {
  tenant: Tenant;
}

// ── Resize logo côté client (max 200px de haut) ───────────────────────────────

const MAX_H = 200;

async function resizeLogo(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.height <= MAX_H) { resolve(file); return; }
      const ratio   = MAX_H / img.height;
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(img.width * ratio);
      canvas.height = MAX_H;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: file.type })),
        file.type,
        0.9,
      );
    };
    img.src = url;
  });
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200';
const monoCls  = inputCls + ' font-mono tracking-wide';

// ── Component ─────────────────────────────────────────────────────────────────

export function SocieteForm({ tenant }: Props) {
  const [pending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string | null>(tenant.logo_url);
  const [pendingLogo,  setPendingLogo]  = useState<File | null>(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const resized = await resizeLogo(f);
    setPendingLogo(resized);
    setLogoPreview(URL.createObjectURL(resized));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      // Upload logo d'abord si modifié
      if (pendingLogo) {
        const logoFd = new FormData();
        logoFd.append('file', pendingLogo);
        const logoRes = await uploadLogoAction(logoFd);
        if ('error' in logoRes) { setError(logoRes.error ?? 'Erreur upload'); return; }
        setPendingLogo(null);
      }

      const input: SocieteInput = {
        name:                (fd.get('name')                as string ?? '').trim(),
        siret:               (fd.get('siret')               as string ?? '').trim(),
        tva_intra:           (fd.get('tva_intra')           as string ?? '').trim(),
        address:             (fd.get('address')             as string ?? '').trim(),
        cp:                  (fd.get('cp')                  as string ?? '').trim(),
        ville:               (fd.get('ville')               as string ?? '').trim(),
        phone:               (fd.get('phone')               as string ?? '').trim(),
        email:               (fd.get('email')               as string ?? '').trim(),
        iban:                (fd.get('iban')                as string ?? '').trim(),
        bic:                 (fd.get('bic')                 as string ?? '').trim(),
        conditions_paiement: (fd.get('conditions_paiement') as string ?? '').trim(),
        mentions_legales:    (fd.get('mentions_legales')    as string ?? '').trim(),
      };

      const res = await updateSocieteAction(input);
      if ('error' in res) { setError(res.error ?? 'Erreur'); return; }
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Logo ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-24 w-24 shrink-0 rounded-xl border-2 border-dashed border-slate-200 bg-white flex items-center justify-center overflow-hidden">
          {logoPreview
            ? <img src={logoPreview} alt="Logo société" className="h-full w-full object-contain p-1.5" />
            : <span className="text-xs text-slate-400 text-center leading-tight px-2">Logo<br />société</span>
          }
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Logo de la société</p>
          <p className="text-xs text-slate-400 mb-3">
            PNG ou JPG, redimensionné automatiquement à 200px de haut.<br />
            Affiché sur les devis et les factures PDF.
          </p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-white transition-colors"
          >
            {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
          </button>
          {pendingLogo && (
            <span className="ml-3 text-xs text-slate-400">● Nouveau logo prêt à être sauvegardé</span>
          )}
        </div>
      </div>

      {/* ── Identité ── */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
          Identité
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de la société *">
            <input name="name" defaultValue={tenant.name} required className={inputCls} />
          </Field>
          <Field label="SIRET">
            <input name="siret" defaultValue={tenant.siret ?? ''} maxLength={14}
              placeholder="12345678901234" className={monoCls} />
          </Field>
          <Field label="N° TVA intracommunautaire">
            <input name="tva_intra" defaultValue={tenant.tva_intra ?? ''}
              placeholder="FR12345678901" className={monoCls} />
          </Field>
          <Field label="Email de la société">
            <input name="email" type="email" defaultValue={tenant.email ?? ''} className={inputCls} />
          </Field>
          <Field label="Téléphone">
            <input name="phone" defaultValue={tenant.phone ?? ''} className={inputCls} />
          </Field>
        </div>
      </fieldset>

      {/* ── Adresse ── */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
          Adresse
        </legend>
        <Field label="Adresse">
          <input name="address" defaultValue={tenant.address ?? ''} placeholder="12 rue de la Paix" className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Code postal">
            <input name="cp" defaultValue={tenant.cp ?? ''} maxLength={10} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ville">
              <input name="ville" defaultValue={tenant.ville ?? ''} className={inputCls} />
            </Field>
          </div>
        </div>
      </fieldset>

      {/* ── Facturation ── */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
          Facturation
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="IBAN">
            <input name="iban" defaultValue={tenant.iban ?? ''}
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" className={monoCls} />
          </Field>
          <Field label="BIC / SWIFT">
            <input name="bic" defaultValue={tenant.bic ?? ''}
              placeholder="BNPAFRPPXXX" className={monoCls} />
          </Field>
        </div>
        <Field label="Conditions de paiement par défaut">
          <input name="conditions_paiement"
            defaultValue={tenant.conditions_paiement ?? 'Paiement à 30 jours'}
            className={inputCls} />
        </Field>
        <Field label="Mentions légales (affichées en bas des factures)">
          <textarea
            name="mentions_legales"
            rows={4}
            defaultValue={tenant.mentions_legales ?? ''}
            placeholder="TVA non applicable, art. 293B du CGI. Pénalités de retard : 3× le taux légal..."
            className={inputCls + ' resize-y'}
          />
        </Field>
      </fieldset>

      {/* ── Feedback ── */}
      {error   && <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">✓ Informations enregistrées avec succès.</p>}

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}
