import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/ui/DashboardShell';

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

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role')
    .eq('id', user.id)
    .single();

  const userName  = profile?.name  ?? user.email ?? 'Utilisateur';
  const userEmail = profile?.email ?? user.email ?? '';
  const role      = profile?.role  ?? 'dirigeant';  // fallback = accès total si profil manquant

  // dirigeant = aucune restriction (undefined = tout afficher)
  const allowedHrefs = role === 'dirigeant' ? undefined : (ROLE_MODULES[role] ?? ROLE_MODULES.commercial);

  return (
    <DashboardShell
      userName={userName}
      userEmail={userEmail}
      allowedHrefs={allowedHrefs}
    >
      {children}
    </DashboardShell>
  );
}
