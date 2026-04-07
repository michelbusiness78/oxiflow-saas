import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/voice-data
// Returns live context (companies, clients, technicians) for the voice agent system prompt.
// Must use createAdminClient() to bypass RLS.

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, name, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });
  }

  const tenantId = profile.tenant_id as string;

  const [companiesRes, clientsRes, techsRes] = await Promise.all([
    admin
      .from('companies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name'),
    admin
      .from('clients')
      .select('id, nom')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('nom')
      .limit(40),
    admin
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('role', 'technicien')
      .order('name'),
  ]);

  return NextResponse.json({
    companies:   (companiesRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
    clients:     (clientsRes.data   ?? []).map((c) => ({ id: c.id as string, name: c.nom  as string })),
    technicians: (techsRes.data     ?? []).map((u) => ({ id: u.id as string, name: u.name as string })),
    currentUser: {
      id:   user.id,
      role: (profile.role as string) ?? 'dirigeant',
      name: (profile.name as string) ?? '',
    },
  });
}
