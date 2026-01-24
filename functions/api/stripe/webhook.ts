import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getSupabaseAdmin = (env: Env) => {
  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const textEncoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

const verifyStripeSignature = async (payload: string, signature: string, secret: string) => {
  const parts = signature.split(',').map((item) => item.trim())
  const timestampPart = parts.find((item) => item.startsWith('t='))
  const v1Parts = parts.filter((item) => item.startsWith('v1='))
  if (!timestampPart || v1Parts.length === 0) return false
  const timestamp = timestampPart.slice(2)
  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(signedPayload))
  const expected = toHex(signatureBuffer)
  return v1Parts.some((part) => timingSafeEqual(part.slice(3), expected))
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { headers: corsHeaders })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secret = env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return jsonResponse({ error: 'STRIPE_WEBHOOK_SECRET is not set.' }, 500)
  }

  const signature = request.headers.get('stripe-signature') || ''
  const body = await request.text()
  const isValid = await verifyStripeSignature(body, signature, secret)
  if (!isValid) {
    return jsonResponse({ error: 'Invalid signature.' }, 401)
  }

  const event = body ? JSON.parse(body) : null
  if (!event?.type) {
    return jsonResponse({ error: 'Invalid event payload.' }, 400)
  }

  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true })
  }

  const session = event.data?.object ?? {}
  if (session.payment_status && session.payment_status !== 'paid') {
    return jsonResponse({ received: true })
  }

  const tickets = Number(session.metadata?.tickets ?? 0)
  const email = String(session.metadata?.email ?? session.customer_details?.email ?? '')
  const userId = String(session.metadata?.user_id ?? session.client_reference_id ?? '')
  const usageId = String(event.id ?? session.id ?? '')
  const stripeCustomerId = session.customer ? String(session.customer) : null

  if (!tickets || !email || !userId || !usageId) {
    return jsonResponse({ error: 'Missing metadata.' }, 400)
  }

  const admin = getSupabaseAdmin(env)
  if (!admin) {
    return jsonResponse({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500)
  }

  const { data: existingEvent } = await admin
    .from('ticket_events')
    .select('id')
    .eq('usage_id', usageId)
    .maybeSingle()

  if (existingEvent) {
    return jsonResponse({ received: true, duplicate: true })
  }

  const { data: ticketRow, error: ticketError } = await admin
    .from('user_tickets')
    .select('id, tickets, stripe_customer_id')
    .or(`user_id.eq.${userId},email.eq.${email}`)
    .maybeSingle()

  if (ticketError) {
    return jsonResponse({ error: ticketError.message }, 500)
  }

  if (ticketRow) {
    const { error: updateError } = await admin
      .from('user_tickets')
      .update({
        tickets: ticketRow.tickets + tickets,
        stripe_customer_id: stripeCustomerId ?? ticketRow.stripe_customer_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketRow.id)
    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }
  } else {
    const { error: insertError } = await admin.from('user_tickets').insert({
      email,
      user_id: userId,
      tickets,
      stripe_customer_id: stripeCustomerId,
    })
    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500)
    }
  }

  const { error: eventError } = await admin.from('ticket_events').insert({
    usage_id: usageId,
    email,
    user_id: userId,
    delta: tickets,
    reason: 'stripe_purchase',
    metadata: {
      price_id: session.metadata?.price_id ?? null,
      plan_label: session.metadata?.plan_label ?? null,
      session_id: session.id ?? null,
    },
  })

  if (eventError) {
    return jsonResponse({ error: eventError.message }, 500)
  }

  return jsonResponse({ received: true })
}
