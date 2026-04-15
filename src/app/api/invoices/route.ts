import { NextResponse }         from 'next/server';
import { getAuthContext }       from '@/lib/auth-context';
import { getStripeServer }      from '@/lib/stripe';
import { createAdminClient }    from '@/lib/supabase/server';

export async function GET() {
  try {
    const { tenant_id } = await getAuthContext();
    const admin         = createAdminClient();

    // Récupère le Stripe Customer ID via la table stripe_customers
    const { data: sc } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('tenant_id', tenant_id)
      .single();

    if (!sc?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = getStripeServer();

    const { data: stripeInvoices } = await stripe.invoices.list({
      customer: sc.stripe_customer_id,
      limit:    6,
    });

    const invoices = stripeInvoices.map((inv) => ({
      id:     inv.id,
      date:   new Date(inv.created * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      amount: inv.total != null
        ? `${(inv.total / 100).toFixed(2).replace('.', ',')} € TTC`
        : '—',
      status: inv.status ?? 'open',
      pdfUrl: inv.invoice_pdf ?? null,
    }));

    return NextResponse.json({ invoices });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('[api/invoices]', message);
    return NextResponse.json({ invoices: [] });
  }
}
