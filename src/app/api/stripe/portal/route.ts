import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getStripeServer } from '@/lib/stripe';

export async function POST() {
  try {
    const { tenant_id } = await getAuthContext();
    const admin = (await import('@/lib/supabase/server')).createAdminClient();

    // Récupère le Stripe Customer ID du tenant
    const { data: sc } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenant_id)
      .single();

    if (!sc?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement trouvé pour ce compte.' },
        { status: 404 },
      );
    }

    const stripe  = getStripeServer();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer:   sc.stripe_customer_id,
      return_url: `${baseUrl}/pilotage/abonnement`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('[stripe/portal]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
