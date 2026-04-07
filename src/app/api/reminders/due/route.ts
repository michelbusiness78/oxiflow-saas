import { NextResponse }      from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/reminders/due
// Retourne les tâches dont le rappel est dû pour l'utilisateur connecté.
// Utilisé par ReminderBanner (polling client toutes les 5 min).

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ reminders: [] });
  }

  const admin = createAdminClient();
  const now   = new Date();
  const nowDate = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5);

  const { data } = await admin
    .from('project_tasks')
    .select('id, name, note, priority, due, reminder_date, reminder_time')
    .eq('user_id', user.id)
    .eq('reminder_active', true)
    .eq('done', false)
    .lte('reminder_date', nowDate);

  const due = (data ?? []).filter((t) => {
    const rd = t.reminder_date as string | null;
    const rt = t.reminder_time as string | null;
    if (!rd) return false;
    if (rd < nowDate) return true;
    return rd === nowDate && (!rt || rt <= nowTime);
  });

  return NextResponse.json({
    reminders: due.map((t) => ({
      id:       t.id       as string,
      name:     t.name     as string,
      note:     (t.note    as string | null) ?? null,
      priority: (t.priority as string) ?? 'normale',
      due:      (t.due     as string | null) ?? null,
    })),
  });
}
