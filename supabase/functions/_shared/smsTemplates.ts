// ============================================================
// TopTier canonical SMS template library
// All outbound customer + partner SMS bodies should be built
// from this module to enforce brand voice + opt-out compliance.
// ============================================================

export const SMS_TEMPLATES = {
  // === CUSTOMER-FACING ===

  booking_received: (data: { service_name: string }) =>
    `Your TopTier ${data.service_name} request is received. Our concierge confirms within 1 hour. Reply STOP to opt out.`,

  booking_confirmed_transport: (data: {
    service_name: string;
    pickup_time: string;
    pickup_location: string;
    verification_code?: string;
  }) => {
    const code = data.verification_code ? `\nCode: ${data.verification_code}` : "";
    return `Your TopTier ${data.service_name} is confirmed. Pickup ${data.pickup_time} at ${data.pickup_location}.${code}\nReply STOP to opt out.`;
  },

  booking_confirmed_hotel: (data: {
    hotel_name: string;
    check_in: string;
    check_out: string;
    confirmed_rate: number;
    room_type: string;
    instructions?: string;
  }) => {
    const inst = data.instructions ? `\n${data.instructions}` : "";
    return `Your TopTier stay at ${data.hotel_name} is confirmed.\n📅 ${data.check_in} - ${data.check_out}\n🛏 ${data.room_type}\n💵 $${data.confirmed_rate}/night${inst}\nReply STOP to opt out.`;
  },

  booking_confirmed_club: (data: {
    club_name: string;
    date_time: string;
    party_size: number;
    table_type: string;
    rate: number;
    dress_code?: string;
    verification_code?: string;
  }) => {
    const dress = data.dress_code ? `\n👔 Dress: ${data.dress_code}` : "";
    const code = data.verification_code ? `\nCode: ${data.verification_code}` : "";
    return `Your TopTier night at ${data.club_name} is confirmed.\n📅 ${data.date_time}\n👥 Party of ${data.party_size}\n🪑 ${data.table_type}\n💵 $${data.rate}${dress}${code}\nReply STOP to opt out.`;
  },

  booking_confirmed_generic: (data: {
    service_name: string;
    vendor_name: string;
    date: string;
    total: number;
  }) =>
    `Your TopTier ${data.service_name} with ${data.vendor_name} on ${data.date} is confirmed. Total $${data.total}. Reply STOP to opt out.`,

  booking_declined: (data: {
    service_name: string;
    reason: string;
    alternatives_url?: string;
  }) => {
    const alt = data.alternatives_url ? `\nBrowse alternatives: ${data.alternatives_url}` : "";
    return `Your TopTier ${data.service_name} request could not be confirmed.\nReason: ${data.reason}${alt}\nReply to chat with concierge.\nReply STOP to opt out.`;
  },

  booking_reminder_24h: (data: {
    service_name: string;
    scheduled_time: string;
    pickup_location?: string;
  }) => {
    const loc = data.pickup_location ? ` at ${data.pickup_location}` : "";
    return `Tomorrow: your TopTier ${data.service_name} at ${data.scheduled_time}${loc}. We'll send a 2-hour reminder. Reply STOP to opt out.`;
  },

  booking_reminder_2h: (data: {
    service_name: string;
    scheduled_time: string;
    verification_code?: string;
  }) => {
    const code = data.verification_code ? `\nCode: ${data.verification_code}` : "";
    return `Your TopTier ${data.service_name} starts in 2 hours at ${data.scheduled_time}.${code}\nReply STOP to opt out.`;
  },

  // === PARTNER-FACING ===

  partner_dispatch: (data: {
    service_name: string;
    pickup_time: string;
    pickup_location: string;
    customer_name: string;
    accept_url: string;
    verification_code?: string;
  }) => {
    const code = data.verification_code ? `\nVerify code: ${data.verification_code}` : "";
    return `🚨 New TopTier booking\n${data.service_name} at ${data.pickup_time}\n📍 ${data.pickup_location}\nCustomer: ${data.customer_name}${code}\nAccept: ${data.accept_url}\nReply STOP to opt out.`;
  },

  partner_dispatch_hourly: (data: {
    service_name: string;
    pickup_time: string;
    hours_booked: number;
    end_time: string;
    pickup_location: string;
    customer_name: string;
    accept_url: string;
  }) =>
    `🚨 New TopTier hourly booking\n⏱ ${data.hours_booked}h: ${data.pickup_time} → ${data.end_time}\n📍 ${data.pickup_location}\nCustomer: ${data.customer_name}\nAccept: ${data.accept_url}\nReply STOP to opt out.`,

  partner_quote_request: (data: {
    service_name: string;
    date: string;
    quote_url: string;
  }) =>
    `🔔 TopTier quote request\n${data.service_name} on ${data.date}\nSubmit: ${data.quote_url}\nReply STOP to opt out.`,

  partner_quote_coach_bus: (data: {
    pickup_city: string;
    dropoff_city: string;
    date: string;
    passengers: number | string;
    quote_url: string;
  }) =>
    `🚌 TopTier coach bus quote\n${data.pickup_city} → ${data.dropoff_city}\n${data.date} · ${data.passengers} pax\nSubmit: ${data.quote_url}\nReply STOP to opt out.`,

  partner_request_confirm: (data: {
    service_name: string;
    date: string;
    notes?: string;
  }) => {
    const n = data.notes ? `\n${data.notes}` : "";
    return `🔔 New TopTier booking request\n${data.service_name} on ${data.date}${n}\nReply 1 = Available, 2 = Not Available\nReply STOP to opt out.`;
  },

  partner_rate_customer_invite: (data: {
    booking_id_short: string;
    rate_url: string;
  }) =>
    `Booking #${data.booking_id_short} completed.\n⭐ Rate your customer: ${data.rate_url}\nReply STOP to opt out.`,

  // === ADMIN-FACING ===

  admin_new_booking: (data: {
    service_name: string;
    customer_name: string;
    amount: number;
    booking_id_short: string;
  }) =>
    `📩 New TopTier ${data.service_name} booking\nCustomer: ${data.customer_name}\nAmount: $${data.amount}\n#${data.booking_id_short}`,

  admin_payment_failed: (data: {
    customer_name: string;
    amount: number;
    booking_id_short: string;
    reason: string;
  }) =>
    `⚠ Payment failed on TopTier booking\nCustomer: ${data.customer_name}\nAmount: $${data.amount}\nReason: ${data.reason}\n#${data.booking_id_short}`,

  admin_customer_flagged: (data: {
    customer_name: string;
    rating: number;
    flags: string[];
    booking_id_short: string;
  }) =>
    `⚠ Customer flagged\n${data.customer_name} rated ${data.rating}/5\nFlags: ${data.flags.join(", ")}\n#${data.booking_id_short}`,

  admin_pending_sla_breach: (data: {
    booking_count: number;
    oldest_pending_minutes: number;
  }) =>
    `⏰ ${data.booking_count} TopTier booking(s) pending >1hr\nOldest: ${data.oldest_pending_minutes} min\nReview /admin/bookings`,
  // === GASMASK (brand: GasMask) ===

  gasmask_missed_call_callback: (_: Record<string, never>) =>
    `Hey, this is GasMask — sorry we just missed your call. Reply here and we'll get right back to you. Reply STOP to opt out.`,

  gasmask_order_receipt: (data: {
    store_name: string;
    total: string | number;
    signup_url?: string;
  }) => {
    const signup = data.signup_url
      ? ` Create your portal account: ${data.signup_url}`
      : "";
    return `Receipt — ${data.store_name}: order delivered. Total $${data.total}.${signup} Reply STOP to opt out.`;
  },

  gasmask_signup_invite: (data: { store_name: string; signup_url: string }) =>
    `Welcome to GasMask OS — ${data.store_name}. Create your portal account: ${data.signup_url} Reply STOP to opt out.`,

  gasmask_receipt_test: (data: {
    store_name: string;
    invoice_number: string;
    amount: string | number;
  }) =>
    `Receipt — ${data.store_name}: Invoice ${data.invoice_number} paid. Total $${data.amount}. Thank you! Reply STOP to opt out.`,

  // === BRANDARO (brand: Brandaro Digital) ===

  brandaro_demo_invite: (data: { business_name: string; demo_url: string }) =>
    `Hi! We built a free website preview for ${data.business_name}. Check it out: ${data.demo_url} — Reply STOP to opt out.`,

  brandaro_outreach_default: (_: Record<string, never>) =>
    `Hi! This is Brandaro Digital — we build high-converting websites and dominate Google for local businesses. Browse our portfolio: https://www.brandarodigital.com\n\nReply STOP to opt out.`,

  bland_brandaro_followup: (data: { name?: string }) => {
    const hello = data.name ? `Hi ${data.name}! ` : "Hi! ";
    return `${hello}Aria from Brandaro Digital here — as promised, here's our portfolio of sample websites: https://www.brandarodigital.com\n\nReply STOP to opt out.`;
  },

  // === ADMIN / DIAGNOSTIC ===

  twilio_admin_test: (data: { timestamp: string }) =>
    `TopTier admin SMS test — sent at ${data.timestamp}. Reply STOP to opt out.`,

  // === CONTACT-NUMBER VERIFICATION ===

  verification_save_number: (data: {
    first_name: string;
    label: string;
    from_number: string;
  }) =>
    `Hi ${data.first_name}, this is ${data.label}. Please save this number (${data.from_number}) as "${data.label}" — this is the number we'll contact you from. Reply YES to confirm you got this. Reply STOP to opt out.`,

  // === CTIA KEYWORD RESPONSES (transactional, no STOP footer per CTIA) ===
  // STOP ack must not invite further messaging; START ack restores delivery.

  stop_acknowledgment: (data: { brand: string }) =>
    `You've been unsubscribed from ${data.brand}. Reply START to opt in again.`,

  start_acknowledgment: (_: Record<string, never>) =>
    `You're resubscribed. Reply STOP to opt out.`,
} as const;

export type SmsTemplateKey = keyof typeof SMS_TEMPLATES;

export function buildSmsTemplate<K extends SmsTemplateKey>(
  templateKey: K,
  data: Parameters<typeof SMS_TEMPLATES[K]>[0],
): string {
  const template = SMS_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown SMS template: ${templateKey}`);
  return (template as (d: unknown) => string)(data);
}
