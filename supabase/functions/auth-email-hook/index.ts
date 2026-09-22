import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createAuthEmailHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Configuration
const SITE_NAME = "SiloShop"
const SENDER_DOMAIN = "notify.siloshop.net"
const ROOT_DOMAIN = "siloshop.net"
const FROM_DOMAIN = "siloshop.net" // Domain shown in From address
const SITE_URL = `https://${ROOT_DOMAIN}`

// Codes are stored as a keyed HMAC (never plain text, never a bare hash):
// a leaked database row cannot be brute-forced back to the 6-digit code
// without the server-side secret.
async function hashCode(value: string): Promise<string> {
  const secret = Deno.env.get('OTP_HASH_SECRET')
  if (!secret) throw new Error('OTP_HASH_SECRET is not configured')
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

// The auth provider issues an 8-digit token; the app's verification screen uses
// a 6-digit code. Issue our own 6-digit code for sign-up confirmation, store its
// hash, and invalidate any previous code for the same address.
async function issueSignupCode(email: string): Promise<string> {
  const digits = new Uint32Array(1)
  crypto.getRandomValues(digits)
  const code = String(digits[0] % 1000000).padStart(6, '0')
  const normalizedEmail = email.trim().toLowerCase()
  const codeHash = await hashCode(`${normalizedEmail}:${code}`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  // Issuing a new code invalidates any previous one for this address.
  await supabase.from('email_verification_codes').delete().eq('email', normalizedEmail)
  const { error } = await supabase.from('email_verification_codes').insert({
    email: normalizedEmail,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    used_at: null,
    attempts: 0,
  })
  if (error) throw new Error(`Failed to store verification code: ${error.message}`)

  return code
}

// Template mapping for preview mode
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://siloshop.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
const handler = createAuthEmailHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
  senderDomain: SENDER_DOMAIN,
  sendUrl: Deno.env.get('LOVABLE_SEND_URL'),
  emails: {
    signup: {
      subject: 'Confirm your email',
      render: (data) =>
        React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: data.email,
          confirmationUrl: data.url,
        }),
    },
    invite: {
      subject: "You've been invited",
      render: (data) =>
        React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl: data.url,
        }),
    },
    magiclink: {
      subject: 'Your login link',
      render: (data) =>
        React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    recovery: {
      subject: 'Reset your password',
      render: (data) =>
        React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    email_change: {
      subject: 'Confirm your new email',
      render: (data) =>
        React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl: data.url,
        }),
    },
    reauthentication: {
      subject: 'Your verification code',
      render: (data) =>
        React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
    },
  },
})

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  return handler(req)
})
