/**
 * NumeriFlow â€” Stripe Webhook Handler
 * Handles subscription cancellation â†’ downgrades plan in Supabase
 * 
 * Set in Stripe Dashboard â†’ Developers â†’ Webhooks:
 * Endpoint URL: https://numeriflow.uk/.netlify/functions/stripe-webhook
 * Events: customer.subscription.deleted, customer.subscription.updated
 */

const crypto = require('crypto');

// Supabase service role key â€” server-side only, never in frontend
const SUPABASE_URL  = 'https://agifyxyoktsivnjoemxu.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY; // set in Netlify env vars
const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // set in Netlify env vars

function verifyStripeSignature(body, signature, secret) {
  if (!secret) return true; // skip verification if secret not set (dev mode)
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const payload = `${parts.t}.${body}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ''));
}

async function updateUserPlan(email, plan) {
  // Find user by email in auth.users via Supabase admin API
  const searchRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  );
  
  if (!searchRes.ok) {
    throw new Error(`User search failed: ${searchRes.status}`);
  }
  
  const data = await searchRes.json();
  const user = data.users?.[0];
  if (!user) {
    console.warn(`[Webhook] No user found for email: ${email}`);
    return false;
  }

  // Update plan in profiles table
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ plan }),
    }
  );

  if (!updateRes.ok) {
    throw new Error(`Profile update failed: ${updateRes.status}`);
  }

  console.log(`[Webhook] Updated ${email} â†’ plan: ${plan}`);
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['stripe-signature'];
  
  // Verify webhook signature
  try {
    if (STRIPE_SECRET && !verifyStripeSignature(event.body, signature, STRIPE_SECRET)) {
      console.error('[Webhook] Invalid Stripe signature');
      return { statusCode: 401, body: 'Invalid signature' };
    }
  } catch(e) {
    return { statusCode: 401, body: 'Signature verification failed' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { type, data } = stripeEvent;
  console.log(`[Webhook] Received: ${type}`);

  try {
    switch(type) {

      case 'customer.subscription.deleted': {
        // Subscription cancelled â€” downgrade to freemium
        const email = data.object.customer_email ||
                      data.object.metadata?.email;
        if (email) {
          await updateUserPlan(email, 'freemium');
          console.log(`[Webhook] Subscription cancelled for ${email} â†’ freemium`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Check if subscription became past_due or unpaid
        const status = data.object.status;
        const email  = data.object.customer_email ||
                       data.object.metadata?.email;
        if (email && ['past_due','unpaid','canceled','incomplete_expired'].includes(status)) {
          await updateUserPlan(email, 'freemium');
          console.log(`[Webhook] Subscription ${status} for ${email} â†’ freemium`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Payment failed â€” could send a warning email here
        const email = data.object.customer_email;
        console.log(`[Webhook] Payment failed for ${email}`);
        // Don't downgrade immediately â€” give Stripe's retry logic a chance
        // Downgrade happens when subscription moves to past_due/canceled
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch(e) {
    console.error('[Webhook] Error processing event:', e.message);
    // Return 200 to prevent Stripe retrying â€” log the error
    return { statusCode: 200, body: JSON.stringify({ received: true, error: e.message }) };
  }
};
