import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';
import { createAdminClient } from '@/lib/supabase/server';

// ─── Client Stripe serveur (singleton lazy) ───────────────────────────────────
// Instancié à la demande pour éviter l'erreur "apiKey not provided" au build

let _stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY manquant');
    _stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
  }
  return _stripe;
}

// ─── Client Stripe frontend (singleton lazy) ─────────────────────────────────

let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}

// ─── Correspondance plan ↔ priceId ───────────────────────────────────────────

export function getPlanPriceIds(): Record<string, string> {
  // Les env vars Stripe gardent le nom STARTER pour rester en mode TEST
  return {
    solo_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY ?? '',
    solo_yearly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY  ?? '',
    team_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY    ?? '',
    team_yearly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY     ?? '',
    pro_monthly:  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY     ?? '',
    pro_yearly:   process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY      ?? '',
  };
}

export function getPlanFromPriceId(priceId: string): string {
  const ids = getPlanPriceIds();
  if (priceId === ids.solo_monthly || priceId === ids.solo_yearly) return 'solo';
  if (priceId === ids.team_monthly || priceId === ids.team_yearly) return 'team';
  if (priceId === ids.pro_monthly  || priceId === ids.pro_yearly)  return 'pro';
  return 'solo';
}

// ─── Helper : récupère ou crée un Stripe Customer pour un tenant ──────────────

export async function getOrCreateStripeCustomer(
  tenantId: string,
  email: string,
  name?: string,
): Promise<string> {
  const admin  = createAdminClient();
  const stripe = getStripeServer();

  const { data: existing } = await admin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name:     name ?? email,
    metadata: { tenant_id: tenantId },
  });

  await admin.from('stripe_customers').insert({
    tenant_id:          tenantId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

// ─── Helper : normalise le statut Stripe vers notre enum DB ──────────────────

export function normalizeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'trialing' | 'active' | 'past_due' | 'canceled' {
  switch (stripeStatus) {
    case 'trialing':  return 'trialing';
    case 'active':    return 'active';
    case 'past_due':  return 'past_due';
    case 'canceled':  return 'canceled';
    default:          return 'past_due';
  }
}
