import { redirect }                           from 'next/navigation';
import { createClient, createAdminClient }     from '@/lib/supabase/server';
import { getCompanies, getCompanyObjectives }  from '@/app/actions/companies';
import { getTenantUsers }                      from '@/app/actions/users-management';
import { SettingsTabs }  from '@/components/settings/SettingsTabs';
import { CompanyList }   from '@/components/settings/CompanyList';
import { UserList }      from '@/components/settings/UserList';
import { Subscription }  from '@/components/settings/Subscription';

export default async function ParametresPage() {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  // ── Profil ───────────────────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role as string | null) ?? 'dirigeant';
  if (role !== 'dirigeant') redirect('/pilotage');

  const tenantId    = profile?.tenant_id as string;
  const currentYear = new Date().getFullYear();

  // ── Données parallèles ───────────────────────────────────────────────────────
  const [tenantRes, tenantUsers, companiesRaw, objectives] = await Promise.all([
    admin.from('tenants').select('id, name, email').eq('id', tenantId).single(),
    getTenantUsers(tenantId),
    getCompanies(tenantId),
    getCompanyObjectives(tenantId, currentYear),
  ]);

  const tenant = tenantRes.data as { id: string; name: string; email?: string } | null;

  // ── Auto-migration : créer une company depuis le tenant si aucune n'existe ──
  let companies = companiesRaw;
  if (companies.length === 0 && tenant) {
    await admin.from('companies').insert({
      tenant_id: tenantId,
      name:      tenant.name ?? 'Ma Société',
      email:     (tenant as Record<string, unknown>).email ?? null,
      active:    true,
    });
    companies = await getCompanies(tenantId);
  }

  const tenant_ = tenantRes.data as Record<string, unknown> | null;
  const plan       = (tenant_?.plan       as string | null) ?? 'trial';
  const plan_debut = (tenant_?.plan_debut as string | null) ?? (tenant_?.created_at as string | null) ?? new Date().toISOString();
  const plan_fin   = (tenant_?.plan_fin   as string | null) ?? new Date(Date.now() + 14 * 86_400_000).toISOString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Paramètres</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Gérez vos sociétés, votre équipe et votre abonnement
        </p>
      </div>

      <SettingsTabs
        societes={<CompanyList companies={companies} objectives={objectives} />}
        utilisateurs={
          <UserList
            users={tenantUsers}
            companies={companies}
            currentUserId={user.id}
            plan={plan}
          />
        }
        abonnement={
          <Subscription
            plan={plan}
            plan_debut={plan_debut}
            plan_fin={plan_fin}
          />
        }
      />
    </div>
  );
}
