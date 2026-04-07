import { redirect }                       from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDashboardDirigeant }           from '@/app/actions/dirigeant';
import { DirigeantDashboard }              from '@/components/dashboard/DirigeantDashboard';
import { getPersonalTasks }                from '@/app/actions/tasks';

export default async function DashboardDirigeantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, name')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.tenant_id as string;

  const [data, personalTasks] = await Promise.all([
    getDashboardDirigeant(tenantId, user.id),
    getPersonalTasks(tenantId, user.id),
  ]);

  return (
    <DirigeantDashboard
      data={data}
      personalTasks={personalTasks}
      userId={user.id}
      tenantId={tenantId}
    />
  );
}
