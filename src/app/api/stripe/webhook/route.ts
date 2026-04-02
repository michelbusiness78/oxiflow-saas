import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeServer, getPlanFromPriceId, normalizeStatus } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit un timestamp Unix Stripe en ISO string (ou null) */
function ts(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

/**
 * Extrait la date de fin de période depuis un Subscription Stripe v21.
 * - Pendant l'essai : trial_end
 * - Après l'essai  : period_end de la dernière facture (si expanded)
 */
function periodEnd(sub: Stripe.Subscription): string | null {
  if (sub.trial_end) return ts(sub.trial_end);
  const inv = sub.latest_invoice;
  if (inv && typeof inv !== 'string') return ts(inv.period_end);
  return null;
}

/** Extrait le subscription ID depuis un Invoice (string | Subscription) */
function subIdFromInvoice(inv: Stripe.Invoice): string | null {
  const raw = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : raw.id;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  const stripe = getStripeServer();

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature invalide';
    console.error('[stripe/webhook] signature error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {

      // ── Checkout terminé → créer l'abonnement en base ───────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const stripeSubId = session.subscription as string;
        const customerId  = session.customer     as string;
        const plan        = (session.metadata?.plan ?? 'starter') as string;

        // Récupère le tenant depuis stripe_customers
        const { data: sc } = await admin
          .from('stripe_customers')
          .select('tenant_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!sc?.tenant_id) break;

        // Récupère la subscription avec la dernière facture pour la date de fin
        const sub = await stripe.subscriptions.retrieve(stripeSubId, {
          expand: ['latest_invoice'],
        });

        await admin.from('subscriptions').upsert({
          tenant_id:              sc.tenant_id,
          stripe_subscription_id: stripeSubId,
          plan,
          status:                 normalizeStatus(sub.status),
          current_period_start:   ts(sub.start_date),
          current_period_end:     periodEnd(sub),
          cancel_at:              ts(sub.cancel_at),
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

        break;
      }

      // ── Abonnement mis à jour → synchro statut / plan / dates ───────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price?.id ?? '';
        const plan    = getPlanFromPriceId(priceId);

        // Récupère la facture pour la date de période
        const expanded = await stripe.subscriptions.retrieve(sub.id, {
          expand: ['latest_invoice'],
        });

        await admin
          .from('subscriptions')
          .update({
            plan,
            status:               normalizeStatus(sub.status),
            current_period_start: ts(sub.start_date),
            current_period_end:   periodEnd(expanded),
            cancel_at:            ts(sub.cancel_at),
            updated_at:           new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        break;
      }

      // ── Abonnement supprimé → passe en canceled ──────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        await admin
          .from('subscriptions')
          .update({
            status:     'canceled',
            cancel_at:  new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        break;
      }

      // ── Paiement échoué → passe en past_due ─────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice   = event.data.object as Stripe.Invoice;
        const stripeSubId = subIdFromInvoice(invoice);
        if (!stripeSubId) break;

        await admin
          .from('subscriptions')
          .update({
            status:     'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSubId);

        break;
      }
    }
  } catch (err) {
    // On log mais on répond toujours 200 — Stripe réessaie sinon
    console.error('[stripe/webhook] handler error:', err);
  }

  return NextResponse.json({ received: true });
}
