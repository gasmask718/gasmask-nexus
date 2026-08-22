// Shared settlement for ut_event_bookings (MON-03 loop closure).
// Posts a fully-paid event booking to the EXISTING ut-ingest pipe, which
// appends to business_transactions. Dedupe is delegated to ut-ingest's
// unique index on (source_system, external_transaction_id): the
// transaction_id below is derived deterministically from the booking id,
// so retries never double-post.

export interface SettleableBooking {
  id: string;
  name: string | null;
  email: string | null;
  full_price: number | null;
  deposit_paid: boolean | null;
  status: string | null;
  event_type: string | null;
  package_name: string | null;
  updated_at: string | null;
  source?: string | null;
  source_booking_id?: string | null;
}

export interface SettleResult {
  settled: boolean;
  duplicate?: boolean;
  skipped?: string;
  error?: string;
  ledger_row_id?: string | null;
}

export async function settleEventBooking(booking: SettleableBooking): Promise<SettleResult> {
  if (!booking.deposit_paid) return { settled: false, skipped: 'deposit_not_paid' };
  const amount = Number(booking.full_price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return { settled: false, skipped: 'no_amount' };

  const ingestSecret = Deno.env.get('UT_INGEST_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!ingestSecret || !supabaseUrl) {
    console.error('settleEventBooking: UT_INGEST_SECRET or SUPABASE_URL not configured');
    return { settled: false, error: 'settlement_not_configured' };
  }

  const transactionId = `ut-event-booking-${booking.id}`;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ut-ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ingestSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        transaction_type: 'booking',
        amount,
        occurred_at: booking.updated_at ?? new Date().toISOString(),
        entity_type: 'event_booking',
        entity_id: booking.id,
        customer_email: booking.email ?? undefined,
        description: `UT event booking ${booking.event_type ?? 'event'} — ${booking.name ?? 'customer'}`,
        metadata: {
          booking_id: booking.id,
          origin_source: booking.source ?? 'unforgettable',
          source_booking_id: booking.source_booking_id ?? null,
          event_type: booking.event_type ?? null,
          package_name: booking.package_name ?? null,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      console.error('settleEventBooking: ut-ingest rejected', res.status, JSON.stringify(data));
      return { settled: false, error: `ut-ingest ${res.status}: ${data?.error ?? 'unknown'}` };
    }
    return { settled: true, duplicate: !!data?.duplicate, ledger_row_id: data?.id ?? null };
  } catch (e) {
    console.error('settleEventBooking: fetch failed', e);
    return { settled: false, error: String(e) };
  }
}
