import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient }         from '@/lib/supabase/server';

const RESET_SECRET = 'OXIFLOW_RESET_2026';

// Tables vidées dans l'ordre (FK oblige)
const TABLES = [
  'invoice_lines',
  'invoices',
  'quote_lines',
  'quotes',
  'project_tasks',
  'project_notifications',
  'interventions',
  'projects',
  'clients',
  'catalogue',
  'company_objectives',
  'api_usage',
  'dossiers',
  'taches',
  'sav_tickets',
  'contrats',
] as const;

export async function GET(req: NextRequest) {
  // ── Auth par secret ──────────────────────────────────────────────────────────
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== RESET_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin   = createAdminClient();
  const results: Record<string, number> = {};
  const errors:  Record<string, string> = {};

  // ── Vider chaque table ───────────────────────────────────────────────────────
  for (const table of TABLES) {
    // DELETE avec condition toujours vraie (id IS NOT NULL ou created_at IS NOT NULL)
    // On utilise neq sur un uuid inexistant pour forcer le DELETE de toutes les lignes
    const { data, error } = await admin
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (error) {
      // Table peut ne pas exister — on continue
      errors[table] = error.message;
      results[table] = 0;
    } else {
      results[table] = data?.length ?? 0;
    }
  }

  const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    success:      true,
    totalDeleted,
    tables:       results,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
