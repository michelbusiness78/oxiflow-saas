import { redirect }                    from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SettingsTabs }     from '@/components/settings/SettingsTabs';
import { SocieteForm }      from '@/components/settings/SocieteForm';
import { UserManagement }   from '@/components/settings/UserManagement';
import { Subscription }     from '@/components/settings/Subscription';

export default async function ParametresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Récupère le profil — si la query RLS échoue, on tente avec l'admin client
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  // Fallback admin si RLS bloque le row owner (même bug que /technicien)
  const resolvedProfile = profile ?? await (async () => {
    const admin = await createAdminClient();
    const { data } = await admin
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    return data;
  })();

  // Ne rediriger QUE si le rôle est explicitement non-dirigeant
  const role = resolvedProfile?.role ?? 'dirigeant';
  if (role !== 'dirigeant') redirect('/pilotage');

  // Sans tenant_id la page ne peut rien afficher
  if (!resolvedProfile?.tenant_id) redirect('/pilotage');

  const tenantId = resolvedProfile.tenant_id as string;

  // Données tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (!tenant) redirect('/pilotage');

  // Utilisateurs du tenant
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  // Valeurs par défaut si colonnes plan absentes (avant migration)
  const plan       = (tenant as Record<string, unknown>).plan       as string      ?? 'trial';
  const plan_debut = (tenant as Record<string, unknown>).plan_debut as string|null ?? tenant.created_at;
  const plan_fin   = (tenant as Record<string, unknown>).plan_fin   as string|null
    ?? new Date(Date.now() + 14 * 86_400_000).toISOString();

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
              name:                tenant.name,
              siret:               (tenant as Record<string, unknown>).siret               as string | null ?? null,
              tva_intra:           (tenant as Record<string, unknown>).tva_intra           as string | null ?? null,
              address:             (tenant as Record<string, unknown>).address             as string | null ?? null,
              cp:                  (tenant as Record<string, unknown>).cp                  as string | null ?? null,
              ville:               (tenant as Record<string, unknown>).ville               as string | null ?? null,
              phone:               (tenant as Record<string, unknown>).phone               as string | null ?? null,
              email:               (tenant as Record<string, unknown>).email               as string | null ?? null,
              logo_url:            (tenant as Record<string, unknown>).logo_url            as string | null ?? null,
              iban:                (tenant as Record<string, unknown>).iban                as string | null ?? null,
              bic:                 (tenant as Record<string, unknown>).bic                 as string | null ?? null,
              conditions_paiement: (tenant as Record<string, unknown>).conditions_paiement as string | null ?? null,
              mentions_legales:    (tenant as Record<string, unknown>).mentions_legales    as string | null ?? null,
            }}
          />
        }
        utilisateurs={
          <UserManagement
            users={(users ?? []).map((u) => ({
              ...u,
              status: (u as Record<string, unknown>).status as string ?? 'active',
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
