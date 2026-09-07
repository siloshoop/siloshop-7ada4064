import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Codes are stored as a keyed HMAC (never plain text, never a bare hash):
// a leaked database row cannot be brute-forced back to the 6-digit code
// without the server-side secret.
async function hashCode(value: string): Promise<string> {
  const secret = Deno.env.get('OTP_HASH_SECRET') || ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Length-independent comparison so response timing never leaks how much of the
// code matched.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { email?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return json({ error: 'invalid_email' }, 400)
  }
  if (!/^\d{6}$/.test(code)) {
    return json({ error: 'invalid_code_format' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: record, error: readError } = await supabase
    .from('email_verification_codes')
    .select('id, code_hash, expires_at, used_at, attempts')
    .eq('email', email)
    .maybeSingle()

  if (readError) {
    console.error('Failed to read verification code', readError)
    return json({ error: 'server_error' }, 500)
  }
  if (!record) return json({ error: 'no_code' }, 400)
  if (record.used_at) return json({ error: 'code_used' }, 400)
  if (new Date(record.expires_at).getTime() < Date.now()) return json({ error: 'code_expired' }, 400)
  if (record.attempts >= 10) return json({ error: 'too_many_attempts' }, 429)

  const expected = await hashCode(`${email}:${code}`)
  if (!timingSafeEqual(expected, record.code_hash || '')) {
    await supabase
      .from('email_verification_codes')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id)
    return json({ error: 'code_invalid' }, 400)
  }

  // Mark single-use immediately so a concurrent request cannot reuse it.
  const { data: claimed, error: claimError } = await supabase
    .from('email_verification_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (claimError || !claimed) return json({ error: 'code_used' }, 400)

  // Confirm the account, then hand back a one-time link the client can exchange
  // for a session (same as the provider's own confirmation flow).
  const lookup = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
  const userId = lookup.data?.user?.id
  if (lookup.error || !userId) {
    console.error('Failed to look up account', lookup.error)
    return json({ error: 'server_error' }, 500)
  }

  const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  })
  if (confirmError) {
    console.error('Failed to confirm email', confirmError)
    return json({ error: 'server_error' }, 500)
  }

  // Issue the sign-in token after confirmation so it is still valid.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('Failed to generate session link', linkError)
    return json({ error: 'server_error' }, 500)
  }

  return json({ success: true, token_hash: linkData.properties.hashed_token })
})
