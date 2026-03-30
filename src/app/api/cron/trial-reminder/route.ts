import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { trialEndingEmail } from '@/lib/email-templates';

export async function GET(request: Request) {
  // ── Auth cron ──────────────────────────────────────────────────────────────
  const auth = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── Tenants avec trial se terminant dans ~3 jours ─────────────────────────
  // current_period_end entre demain 00:00 et dans 4 jours 00:00 (fenêtre J-3)
  const now    = new Date();
  const from   = new Date(now);
  from.setDate(from.getDate() + 2);
  from.setHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setDate(to.getDate() + 4);
  to.setHours(0, 0, 0, 0);

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('tenant_id, current_period_end')
    .eq('status', 'trialing')
    .gte('current_period_end', from.toISOString())
    .lt('current_period_end', to.toISOString());

  if (error) {
    console.error('[cron/trial-reminder] supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // ── Pour chaque tenant, récupère l'email/name du dirigeant ────────────────
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const { data: user } = await admin
        .from('users')
        .select('email, name')
        .eq('tenant_id', sub.tenant_id)
        .eq('role', 'dirigeant')
        .maybeSingle();

      if (!user?.email) return;

      const trialEnd  = new Date(sub.current_period_end);
      const msLeft    = trialEnd.getTime() - Date.now();
      const daysLeft  = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

      try {
        const { subject, html } = trialEndingEmail(user.name ?? user.email, daysLeft);
        await sendEmail(user.email, subject, html);
        sent++;
      } catch (err) {
        console.error(`[cron/trial-reminder] email failed for tenant ${sub.tenant_id}:`, err);
      }
    }),
  );

  return NextResponse.json({ sent });
}
