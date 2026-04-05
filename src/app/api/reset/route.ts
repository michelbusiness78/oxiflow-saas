import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient }         from '@/lib/supabase/server';

const RESET_SECRET = 'OXIFLOW_RESET_2026';

// Tables vidées dans l'ordre (FK oblige : enfants d'abord)
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
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== RESET_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin   = createAdminClient();
  const results: Record<string, number | string> = {};

  // ── Vider chaque table ───────────────────────────────────────────────────────
  for (const table of TABLES) {
    const { count, error } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error(`[reset] ${table} — ERREUR : ${error.message}`);
      results[table] = `ERROR: ${error.message}`;
    } else {
      console.log(`[reset] ${table} — ${count ?? 0} lignes supprimées`);
      results[table] = count ?? 0;
    }
  }

  const totalDeleted = Object.values(results)
    .filter((v): v is number => typeof v === 'number')
    .reduce((a, b) => a + b, 0);

  return NextResponse.json({ success: true, totalDeleted, tables: results });
}
