import { NextResponse }       from 'next/server';
import { createAdminClient }  from '@/lib/supabase/server';
import { sendEmail }          from '@/lib/email';

// ── Template email rappel ─────────────────────────────────────────────────────

const PRIO_LABEL: Record<string, string> = {
  urgente: '🔴 URGENT',
  haute:   '🟠 Important',
  high:    '🔴 URGENT',
  normale: '🔵 Normal',
  mid:     '🔵 Normal',
  basse:   '⚪ Basse priorité',
  low:     '⚪ Basse priorité',
};

function reminderEmailHtml(userName: string, taskName: string, note: string | null, priority: string, due: string | null): string {
  const prioLabel = PRIO_LABEL[priority] ?? '🔵 Normal';
  const dueLabel  = due
    ? `· Échéance : ${new Date(due + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <!-- En-tête -->
        <tr>
          <td style="background:#1B2A4A;padding:20px 24px">
            <span style="color:#fff;font-size:20px;font-weight:700">📌 Rappel OxiFlow</span>
          </td>
        </tr>
        <!-- Corps -->
        <tr>
          <td style="background:#ffffff;padding:24px">
            <p style="margin:0 0 8px;font-size:15px;color:#1e293b">Bonjour ${userName},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#64748b">Vous avez un rappel programmé :</p>

            <!-- Carte tâche -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:10px;padding:16px 18px;margin-bottom:20px">
              <div style="font-size:17px;font-weight:700;color:#1e293b;margin-bottom:6px">${taskName}</div>
              ${note ? `<div style="font-size:13px;color:#64748b;margin-bottom:10px;line-height:1.5">${note}</div>` : ''}
              <div style="font-size:12px;color:#94a3b8">${prioLabel} ${dueLabel}</div>
            </div>

            <!-- CTA -->
            <a href="https://oxiflow.fr"
               style="display:inline-block;background:#2563eb;color:#ffffff;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.2px">
              Ouvrir OxiFlow →
            </a>

            <p style="margin:24px 0 0;font-size:11px;color:#cbd5e1;line-height:1.6">
              Ce rappel a été programmé depuis vos tâches OxiFlow.<br>
              Vous pouvez le modifier ou le supprimer dans l'onglet "Mes tâches".
            </p>
          </td>
        </tr>
        <!-- Pied -->
        <tr>
          <td style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0">
            <span style="font-size:11px;color:#94a3b8">OxiFlow · oxiflow.fr</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Handler cron ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // ── Auth Vercel cron ─────────────────────────────────────────────────────────
  const auth   = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now   = new Date();

  // Date/heure UTC → adaptées à la France (UTC+1 ou UTC+2)
  // Le cron tourne en UTC — on accepte une fenêtre ±1h pour éviter les décalages DST.
  const nowDate = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5); // "HH:MM"

  // ── Chercher les tâches dues ──────────────────────────────────────────────────
  // reminder_date <= aujourd'hui ET reminder_active = true ET done = false
  const { data: tasks, error: tasksErr } = await admin
    .from('project_tasks')
    .select('id, name, note, priority, due, reminder_date, reminder_time, user_id')
    .eq('reminder_active', true)
    .eq('done', false)
    .lte('reminder_date', nowDate);

  if (tasksErr) {
    console.error('[cron/reminders] DB error:', tasksErr.message);
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 });
  }

  // Filtrer : si reminder_date = aujourd'hui, vérifier que l'heure est passée
  const due = tasks.filter((t) => {
    const rd = t.reminder_date as string | null;
    const rt = t.reminder_time as string | null;
    if (!rd) return false;
    if (rd < nowDate) return true;           // date passée → toujours envoyer
    if (rd === nowDate) {
      return !rt || rt <= nowTime;           // même jour → vérifier l'heure
    }
    return false;
  });

  if (due.length === 0) {
    return NextResponse.json({ sent: 0, checked: tasks.length });
  }

  // ── Récupérer les emails des utilisateurs (batch) ─────────────────────────────
  const userIds = [...new Set(due.map((t) => t.user_id as string).filter(Boolean))];

  const { data: users } = await admin
    .from('users')
    .select('id, email, name')
    .in('id', userIds);

  const userMap = new Map((users ?? []).map((u) => [u.id, { email: u.email as string, name: (u.name as string) ?? 'Bonjour' }]));

  // ── Envoyer les emails + désactiver les rappels ───────────────────────────────
  let sent = 0;
  const toDisable: string[] = [];

  await Promise.allSettled(
    due.map(async (task) => {
      const uid  = task.user_id as string | null;
      const user = uid ? userMap.get(uid) : null;
      if (!user?.email) return;

      const firstName = (user.name ?? '').split(' ')[0] || 'Bonjour';

      try {
        await sendEmail(
          user.email,
          `📌 Rappel : ${task.name as string}`,
          reminderEmailHtml(
            firstName,
            task.name as string,
            (task.note as string | null) ?? null,
            (task.priority as string) ?? 'normale',
            (task.due as string | null) ?? null,
          ),
        );
        toDisable.push(task.id as string);
        sent++;
      } catch (err) {
        console.error('[cron/reminders] email error:', task.id, err);
      }
    }),
  );

  // Désactiver les rappels envoyés (batch update)
  if (toDisable.length > 0) {
    await admin
      .from('project_tasks')
      .update({ reminder_active: false, updated_at: new Date().toISOString() })
      .in('id', toDisable);
  }

  return NextResponse.json({ sent, checked: tasks.length, due: due.length });
}
