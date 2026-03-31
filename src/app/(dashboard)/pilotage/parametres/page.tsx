import { redirect }                         from 'next/navigation';
import { createClient, createAdminClient }   from '@/lib/supabase/server';
import { getCompanies }     from '@/app/actions/companies';
import { SettingsTabs }     from '@/components/settings/SettingsTabs';
import { CompanyList }      from '@/components/settings/CompanyList';
import { SocieteForm }      from '@/components/settings/SocieteForm';
import { UserManagement }   from '@/components/settings/UserManagement';
import { Subscription }     from '@/components/settings/Subscription';

// ── Fallback tenant vide ───────────────────────────────────────────────────────
const EMPTY_TENANT = {
  name: '', siret: null, tva_intra: null, address: null,
  cp: null, ville: null, phone: null, email: null,
  logo_url: null, iban: null, bic: null,
  conditions_paiement: null, mentions_legales: null,
};

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

  const tenantId = profile?.tenant_id as string;

  // ── Données parallèles ───────────────────────────────────────────────────────
  const [tenantRes, usersRes, companies] = await Promise.all([
    admin.from('tenants').select('*').eq('id', tenantId).single(),
    admin.from('users')
      .select('id, name, email, role, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    getCompanies(tenantId),
  ]);

  const tenant = tenantRes.data as Record<string, unknown> | null;
  const users  = (usersRes.data ?? []).map((row) => ({
    ...row,
    status: (row as Record<string, unknown>).status as string ?? 'active',
  }));

  const plan       = (tenant?.plan       as string | null) ?? 'trial';
  const plan_debut = (tenant?.plan_debut as string | null) ?? (tenant?.created_at as string | null) ?? new Date().toISOString();
  const plan_fin   = (tenant?.plan_fin   as string | null) ?? new Date(Date.now() + 14 * 86_400_000).toISOString();

  const tenantData = tenant
    ? {
        name:                (tenant.name                as string)      ?? '',
        siret:               (tenant.siret               as string|null) ?? null,
        tva_intra:           (tenant.tva_intra           as string|null) ?? null,
        address:             (tenant.address             as string|null) ?? null,
        cp:                  (tenant.cp                  as string|null) ?? null,
        ville:               (tenant.ville               as string|null) ?? null,
        phone:               (tenant.phone               as string|null) ?? null,
        email:               (tenant.email               as string|null) ?? null,
        logo_url:            (tenant.logo_url            as string|null) ?? null,
        iban:                (tenant.iban                as string|null) ?? null,
        bic:                 (tenant.bic                 as string|null) ?? null,
        conditions_paiement: (tenant.conditions_paiement as string|null) ?? null,
        mentions_legales:    (tenant.mentions_legales    as string|null) ?? null,
      }
    : EMPTY_TENANT;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Paramètres</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Gérez vos sociétés, votre équipe et votre abonnement
        </p>
      </div>

      <SettingsTabs
        societes={<CompanyList companies={companies} />}
        societe={<SocieteForm tenant={tenantData} />}
        utilisateurs={
          <UserManagement
            users={users}
            currentId={user.id}
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
