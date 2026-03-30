import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getStripeServer, getOrCreateStripeCustomer, getPlanFromPriceId } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { priceId } = await request.json() as { priceId: string };
    if (!priceId) return NextResponse.json({ error: 'priceId requis' }, { status: 400 });

    // Auth : récupère le tenant et l'email de l'utilisateur connecté
    const { admin, user, tenant_id } = await getAuthContext();

    const { data: profile } = await admin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const email = profile?.email ?? user.email ?? '';
    const name  = profile?.name  ?? '';

    // Crée ou récupère le Stripe Customer
    const customerId = await getOrCreateStripeCustomer(tenant_id, email, name);

    const plan    = getPlanFromPriceId(priceId);
    const stripe  = getStripeServer();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    // Crée la session Checkout Stripe
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenant_id, plan },
      },
      metadata: { tenant_id, plan },
      success_url: `${baseUrl}/pilotage?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/#tarifs`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('[stripe/checkout]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
