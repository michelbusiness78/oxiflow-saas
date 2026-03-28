import { redirect }                       from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProfilForm }                       from '@/components/profil/ProfilForm';

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Profil : client régulier d'abord, admin en fallback
  let profile: { name: string; role: string } | null = null;

  const { data: regularProfile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single();

  if (regularProfile) {
    profile = regularProfile as { name: string; role: string };
  } else {
    try {
      const admin = await createAdminClient();
      const { data: adminProfile } = await admin
        .from('users')
        .select('name, role')
        .eq('id', user.id)
        .single();
      if (adminProfile) profile = adminProfile as { name: string; role: string };
    } catch { /* service role key absent en dev */ }
  }

  const name  = profile?.name ?? user.email?.split('@')[0] ?? '';
  const role  = profile?.role ?? 'commercial';
  const email = user.email ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oxi-text">Mon profil</h1>
        <p className="mt-0.5 text-sm text-oxi-text-secondary">
          Informations personnelles et sécurité du compte
        </p>
      </div>

      <ProfilForm name={name} email={email} role={role} />
    </div>
  );
}
