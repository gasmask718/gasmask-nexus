// Shared security helpers for Dynasty Recovery public-website intake functions.
// Layers (in order): Origin check → Honeypot → Rate limit → Webhook secret.

export const drCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?dynastyrecoverygroup\.com$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.dev$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^http:\/\/localhost:\d+$/,
]

export function isAllowedOrigin(originOrReferer: string): boolean {
  if (!originOrReferer) return false
  // Referer often includes a path; reduce to scheme+host.
  let candidate = originOrReferer
  try {
    const u = new URL(originOrReferer)
    candidate = `${u.protocol}//${u.host}`
  } catch {
    // not a full URL; test as-is
  }
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(candidate))
}

export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...drCorsHeaders, 'Content-Type': 'application/json' },
  })
}

export function originCheck(req: Request): Response | null {
  const origin = req.headers.get('origin') || req.headers.get('referer') || ''
  if (!isAllowedOrigin(origin)) {
    console.warn('Blocked request from unauthorized origin:', origin)
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return null
}

export function isHoneypotTriggered(formData: Record<string, unknown>): boolean {
  return Boolean(formData?.website || formData?.honeypot || formData?.url)
}

export function fakeSuccessResponse(messageType: 'lead' | 'application' | 'inquiry') {
  const id = 'h-' + crypto.randomUUID().slice(0, 8)
  if (messageType === 'lead') {
    return jsonResponse(
      { success: true, lead_id: id, message: 'Lead received. We will contact you within 24-48 hours.' },
      200,
    )
  }
  if (messageType === 'application') {
    return jsonResponse(
      { success: true, application_id: id, message: 'Application received. David will reach out within 2 business days.' },
      200,
    )
  }
  return jsonResponse(
    { success: true, inquiry_id: id, message: 'Message received. We will respond within 1 business day.' },
    200,
  )
}

export function webhookSecretCheck(req: Request): Response | null {
  const provided = req.headers.get('x-webhook-secret')
  if (provided !== Deno.env.get('DYNASTY_RECOVERY_WEBHOOK_SECRET')) {
    console.warn('Invalid webhook secret')
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  return null
}
