import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/ui/DashboardShell';
import { ensureUserProfile } from '@/lib/ensure-profile';
import { getProjectNotifications } from '@/app/actions/projects';

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

  // Badges sidebar + notifications (tout en parallèle)
  let catalogueCount = 0;
  let projectsCount  = 0;
  let notifications: import('@/app/actions/projects').ProjectNotifData[] = [];

  if (tenantId) {
    const admin = await createAdminClient();

    const [catRes, projRes, notifs] = await Promise.all([
      admin
        .from('catalogue')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('actif', true),
      admin
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['nouveau', 'en_cours']),
      getProjectNotifications(user.id),
    ]);

    catalogueCount = catRes.count  ?? 0;
    projectsCount  = projRes.count ?? 0;
    notifications  = notifs as typeof notifications;
  }

  const allowedHrefs = role === 'dirigeant' ? undefined : (ROLE_MODULES[role] ?? ROLE_MODULES.commercial);

  return (
    <DashboardShell
      userName={userName}
      userEmail={userEmail}
      userRole={role}
      allowedHrefs={allowedHrefs}
      moduleCounts={{ '/commerce': catalogueCount, '/projets': projectsCount }}
      notifications={notifications}
    >
      {children}
    </DashboardShell>
  );
}
