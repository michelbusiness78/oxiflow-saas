import { redirect }                         from 'next/navigation';
import { createClient, createAdminClient }   from '@/lib/supabase/server';
import { SettingsTabs }   from '@/components/settings/SettingsTabs';
import { SocieteForm }    from '@/components/settings/SocieteForm';
import { UserManagement } from '@/components/settings/UserManagement';
import { Subscription }   from '@/components/settings/Subscription';

export default async function ParametresPage() {
  // ── 1. Vérifie que l'utilisateur est authentifié ───────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── 2. Profil via admin client (bypass RLS — évite la boucle de redirect) ──
  //    Le client anon + RLS peut retourner null même pour le row owner si
  //    auth_tenant_id() échoue en cascade. L'admin client (service_role) est
  //    fiable en toutes circonstances.
  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  // Seule redirection légitime : rôle explicitement non-dirigeant
  const role = profile?.role ?? 'dirigeant';
  if (role !== 'dirigeant') redirect('/pilotage');

  // Sans tenant_id on ne peut rien afficher (signup incomplet)
  const tenantId = profile?.tenant_id as string | undefined;
  if (!tenantId) redirect('/pilotage');

  // ── 3. Tenant + utilisateurs via admin client ───────────────────────────────
  const [tenantRes, usersRes] = await Promise.all([
    admin.from('tenants').select('*').eq('id', tenantId).single(),
    admin.from('users')
      .select('id, name, email, role, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
  ]);

  const tenant = tenantRes.data;
  if (!tenant) redirect('/pilotage');

  const users = usersRes.data ?? [];

  // Valeurs par défaut pour les colonnes ajoutées en migration 007
  const t          = tenant as Record<string, unknown>;
  const plan       = (t.plan       as string | null) ?? 'trial';
  const plan_debut = (t.plan_debut as string | null) ?? (tenant.created_at as string);
  const plan_fin   = (t.plan_fin   as string | null) ?? new Date(Date.now() + 14 * 86_400_000).toISOString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Paramètres</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Configuration de votre société et de votre équipe
        </p>
      </div>

      <SettingsTabs
        societe={
          <SocieteForm
            tenant={{
              name:                tenant.name        as string,
              siret:               (t.siret               as string | null) ?? null,
              tva_intra:           (t.tva_intra           as string | null) ?? null,
              address:             (t.address             as string | null) ?? null,
              cp:                  (t.cp                  as string | null) ?? null,
              ville:               (t.ville               as string | null) ?? null,
              phone:               (t.phone               as string | null) ?? null,
              email:               (t.email               as string | null) ?? null,
              logo_url:            (t.logo_url            as string | null) ?? null,
              iban:                (t.iban                as string | null) ?? null,
              bic:                 (t.bic                 as string | null) ?? null,
              conditions_paiement: (t.conditions_paiement as string | null) ?? null,
              mentions_legales:    (t.mentions_legales    as string | null) ?? null,
            }}
          />
        }
        utilisateurs={
          <UserManagement
            users={users.map((u) => ({
              ...u,
              status: ((u as Record<string, unknown>).status as string) ?? 'active',
            }))}
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
