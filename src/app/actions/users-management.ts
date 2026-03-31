'use server';

import { revalidatePath }    from 'next/cache';
import { getAuthContext }    from '@/lib/auth-context';
import { createAdminClient } from '@/lib/supabase/server';

const PATH = '/pilotage/parametres';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantUser {
  id:               string;
  name:             string;
  email:            string;
  first_name:       string | null;
  last_name:        string | null;
  role:             string;
  company_id:       string | null;
  company_name:     string | null;
  commercial_code:  string | null;
  color:            string;
  active:           boolean;
  status:           string;
  last_sign_in_at:  string | null;
  created_at:       string;
}

export type UserEditInput = {
  first_name:       string | null;
  last_name:        string | null;
  role:             string;
  company_id:       string | null;
  commercial_code:  string | null;
  color:            string;
  active:           boolean;
};

// ─── getTenantUsers ───────────────────────────────────────────────────────────

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const admin = createAdminClient();

  const [usersRes, companiesRes, authRes] = await Promise.all([
    admin
      .from('users')
      .select('id, name, email, first_name, last_name, role, company_id, commercial_code, color, active, status, created_at')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin.from('companies').select('id, name').eq('tenant_id', tenantId),
    admin.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: { users: [] } })),
  ]);

  if (usersRes.error) console.error('[getTenantUsers] error:', usersRes.error);

  const companiesMap = new Map(
    (companiesRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const authMap = new Map(
    ((authRes as { data: { users: { id: string; last_sign_in_at?: string }[] } }).data?.users ?? [])
      .map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  return (usersRes.data ?? []).map((u) => ({
    id:              u.id              as string,
    name:            (u.name           as string) ?? '',
    email:           (u.email          as string) ?? '',
    first_name:      (u.first_name     as string | null) ?? null,
    last_name:       (u.last_name      as string | null) ?? null,
    role:            (u.role           as string) ?? 'commercial',
    company_id:      (u.company_id     as string | null) ?? null,
    company_name:    companiesMap.get(u.company_id as string) ?? null,
    commercial_code: (u.commercial_code as string | null) ?? null,
    color:           (u.color          as string) ?? '#2563eb',
    active:          (u.active         as boolean) ?? true,
    status:          (u.status         as string) ?? 'active',
    last_sign_in_at: authMap.get(u.id as string) ?? null,
    created_at:      u.created_at      as string,
  }));
}

// ─── saveUser ─────────────────────────────────────────────────────────────────

export async function saveUser(
  input: UserEditInput,
  userId: string,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const nameParts = [input.first_name, input.last_name].filter(Boolean);
  const name      = nameParts.length > 0 ? nameParts.join(' ') : undefined;

  const payload: Record<string, unknown> = {
    first_name:      input.first_name,
    last_name:       input.last_name,
    role:            input.role,
    company_id:      input.company_id,
    commercial_code: input.commercial_code,
    color:           input.color,
    active:          input.active,
    status:          input.active ? 'active' : 'inactive',
  };
  if (name) payload.name = name;

  const { error } = await admin.from('users').update(payload).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}

// ─── toggleUserActive ─────────────────────────────────────────────────────────

export async function toggleUserActive(
  userId: string,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const { data: current } = await admin
    .from('users')
    .select('active')
    .eq('id', userId)
    .single();

  if (!current) return { error: 'Utilisateur introuvable.' };

  const active = !(current.active as boolean);
  const { error } = await admin
    .from('users')
    .update({ active, status: active ? 'active' : 'inactive' })
    .eq('id', userId);

  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { success: true };
}
