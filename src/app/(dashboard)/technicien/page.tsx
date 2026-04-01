import { redirect }            from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TechnicienApp }       from '@/components/technicien/TechnicienApp';
import { getMyInterventions }  from '@/app/actions/technicien';

async function fetchData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('name, tenant_id')
    .eq('id', user.id)
    .single();

  const name     = profile?.name      ?? user.email ?? 'Technicien';
  const tenantId = profile?.tenant_id as string;

  const interventions = await getMyInterventions(tenantId, user.id);

  return {
    currentUser:  { id: user.id, name },
    interventions,
  };
}

export default async function TechnicienPage() {
  const { currentUser, interventions } = await fetchData();

  return (
    <TechnicienApp
      currentUser={currentUser}
      initialInterventions={interventions}
    />
  );
}
