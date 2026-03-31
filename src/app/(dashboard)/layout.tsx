import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/ui/DashboardShell';
import { ensureUserProfile } from '@/lib/ensure-profile';

// Modules autorisés par rôle (en sync avec proxy.ts)
const ROLE_MODULES: Record<string, string[]> = {
  dirigeant:   ['/pilotage', '/commerce', '/projets', '/technicien', '/chef-projet', '/rh'],
  commercial:  ['/pilotage', '/commerce'],
  technicien:  ['/technicien'],
  chef_projet: ['/pilotage', '/projets', '/chef-projet'],
  rh:          ['/pilotage', '/rh'],
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Crée le profil si absent — seulement pour les dirigeants /register
  // (les invités ont leur profil créé par inviteUserAction)
  await ensureUserProfile(user);

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, tenant_id')
    .eq('id', user.id)
    .single();

  const userName  = profile?.name      ?? user.email ?? 'Utilisateur';
  const userEmail = profile?.email     ?? user.email ?? '';
  const role      = profile?.role      ?? 'dirigeant';
  const tenantId  = profile?.tenant_id ?? null;

  // Compteur clients pour le badge sidebar
  let clientCount = 0;
  if (tenantId) {
    const admin = await createAdminClient();
    const { count } = await admin
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);
    clientCount = count ?? 0;
  }

  // dirigeant = aucune restriction (undefined = tout afficher)
  const allowedHrefs = role === 'dirigeant' ? undefined : (ROLE_MODULES[role] ?? ROLE_MODULES.commercial);

  return (
    <DashboardShell
      userName={userName}
      userEmail={userEmail}
      userRole={role}
      allowedHrefs={allowedHrefs}
      moduleCounts={{ '/commerce': clientCount }}
    >
      {children}
    </DashboardShell>
  );
}
