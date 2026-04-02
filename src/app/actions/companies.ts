'use server';

import { revalidatePath }    from 'next/cache';
import { getAuthContext }    from '@/lib/auth-context';
import { createAdminClient } from '@/lib/supabase/server';

const PATH = '/pilotage/parametres';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Company {
  id:                         string;
  tenant_id:                  string;
  name:                       string;
  siret:                      string | null;
  tva_number:                 string | null;
  address:                    string | null;
  postal_code:                string | null;
  city:                       string | null;
  phone:                      string | null;
  email:                      string | null;
  website:                    string | null;
  iban:                       string | null;
  bic:                        string | null;
  logo_url:                   string | null;
  color:                      string;
  mention_tva:                string;
  conditions_paiement_defaut: string;
  pied_facture:               string | null;
  active:                     boolean;
  created_at:                 string;
}

export type CompanyInput = Omit<Company, 'id' | 'tenant_id' | 'created_at'>;

export interface CompanyObjective {
  id:             string;
  company_id:     string;
  tenant_id:      string;
  year:           number;
  monthly_target: number;
  annual_target:  number;
}

export type CompanyObjectiveInput = {
  company_id:     string;
  year:           number;
  monthly_target: number;
  annual_target:  number;
};

// ─── getCompanies ─────────────────────────────────────────────────────────────

export async function getCompanies(tenantId: string): Promise<Company[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('companies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) console.error('[getCompanies] error:', error);
  return (data ?? []) as Company[];
}

// ─── saveCompany ──────────────────────────────────────────────────────────────

export async function saveCompany(
  input: CompanyInput,
  id?: string,
): Promise<{ success?: true; id?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await admin.from('companies').update(payload).eq('id', id);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    return { success: true, id };
  }

  const { data, error } = await admin
    .from('companies')
    .insert({ ...payload, tenant_id })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true, id: data.id as string };
}

// ─── deleteCompany ────────────────────────────────────────────────────────────

export async function deleteCompany(
  companyId: string,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();
  const { error } = await admin.from('companies').delete().eq('id', companyId);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── getCompanyObjectives ─────────────────────────────────────────────────────

export async function getCompanyObjectives(
  tenantId: string,
  year: number,
): Promise<CompanyObjective[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('company_objectives')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('year', year);
  if (error) console.error('[getCompanyObjectives] error:', error);
  return (data ?? []) as CompanyObjective[];
}

// ─── uploadCompanyLogoAction ──────────────────────────────────────────────────

export async function uploadCompanyLogoAction(
  formData: FormData,
  companyId: string,
): Promise<{ success?: true; logo_url?: string; error?: string }> {
  try {
    const { admin, tenant_id } = await getAuthContext();
    const file = formData.get('file') as File | null;
    if (!file) return { error: 'Fichier manquant' };

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${tenant_id}/${companyId}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = admin.storage
      .from('logos')
      .getPublicUrl(path);

    const logo_url = `${publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await admin
      .from('companies')
      .update({ logo_url })
      .eq('id', companyId);

    if (updateError) return { error: updateError.message };
    revalidatePath(PATH);
    return { success: true, logo_url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur upload' };
  }
}

// ─── saveCompanyObjectives ────────────────────────────────────────────────────

export async function saveCompanyObjectives(
  input: CompanyObjectiveInput,
): Promise<{ success?: true; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin
    .from('company_objectives')
    .upsert(
      { ...input, tenant_id },
      { onConflict: 'company_id,year' },
    );

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
