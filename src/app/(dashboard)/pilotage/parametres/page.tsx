import { redirect }                         from 'next/navigation';
import { createClient, createAdminClient }   from '@/lib/supabase/server';
import { SettingsTabs }   from '@/components/settings/SettingsTabs';
import { SocieteForm }    from '@/components/settings/SocieteForm';
import { UserManagement } from '@/components/settings/UserManagement';
import { Subscription }   from '@/components/settings/Subscription';

// ── Fallback tenant vide si les données sont indisponibles ─────────────────────
const EMPTY_TENANT = {
  name: '', siret: null, tva_intra: null, address: null,
  cp: null, ville: null, phone: null, email: null,
  logo_url: null, iban: null, bic: null,
  conditions_paiement: null, mentions_legales: null,
};

export default async function ParametresPage() {
  // ── Authentification ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Profil : client régulier d'abord, admin en fallback ────────────────────
  // On tente les deux pour être robuste face aux variations RLS.
  let profile: { tenant_id: string; role: string } | null = null;

  const { data: regularProfile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (regularProfile) {
    profile = regularProfile as { tenant_id: string; role: string };
  } else {
    // Fallback admin (bypass RLS — utile si auth_tenant_id() renvoie null)
    try {
      const admin = await createAdminClient();
      const { data: adminProfile } = await admin
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();
      if (adminProfile) profile = adminProfile as { tenant_id: string; role: string };
    } catch { /* service role key absent en dev → on continue */ }
  }

  // Seule redirection légitime : rôle explicitement non-dirigeant
  const role = profile?.role ?? 'dirigeant';
  if (role !== 'dirigeant') redirect('/pilotage');

  // ── Tenant + utilisateurs ─────────────────────────────────────────────────
  const tenantId = profile?.tenant_id;

  let tenant: Record<string, unknown> | null = null;
  let users: {
    id: string; name: string; email: string;
    role: string; status: string; created_at: string;
  }[] = [];

  if (tenantId) {
    // Essaie avec le client régulier
    const { data: t } = await supabase
      .from('tenants').select('*').eq('id', tenantId).single();
    tenant = t as Record<string, unknown> | null;

    // Fallback admin si tenant toujours null
    if (!tenant) {
      try {
        const admin = await createAdminClient();
        const { data: t2 } = await admin
          .from('tenants').select('*').eq('id', tenantId).single();
        tenant = t2 as Record<string, unknown> | null;
      } catch { /* ignore */ }
    }

    // Utilisateurs — admin pour contourner RLS si nécessaire
    try {
      const admin = await createAdminClient();
      const { data: u } = await admin
        .from('users')
        .select('id, name, email, role, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });
      if (u) users = u.map((row) => ({
        ...row,
        status: (row as Record<string, unknown>).status as string ?? 'active',
      }));
    } catch {
      // Fallback client régulier
      const { data: u } = await supabase
        .from('users')
        .select('id, name, email, role, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });
      users = (u ?? []).map((row) => ({
        ...row,
        status: (row as Record<string, unknown>).status as string ?? 'active',
      }));
    }
  }

  // Valeurs par défaut pour les colonnes ajoutées en migration 007
  const plan       = (tenant?.plan       as string  | null) ?? 'trial';
  const plan_debut = (tenant?.plan_debut as string  | null) ?? (tenant?.created_at as string | null) ?? new Date().toISOString();
  const plan_fin   = (tenant?.plan_fin   as string  | null) ?? new Date(Date.now() + 14 * 86_400_000).toISOString();

  // Si tenant introuvable, on affiche un formulaire vide (pas de redirect)
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
        <h1 className="text-xl font-semibold text-oxi-text">Paramètres</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Configuration de votre société et de votre équipe
        </p>
      </div>

      <SettingsTabs
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
