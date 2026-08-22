/**
 * _shared/dispatchOutcome.ts — makes suppression-skipped sends VISIBLE.
 *
 * A legal STOP is absolute for workforce + transactional classes (see
 * _shared/twilioSend.ts legalStopBlocked). That means a driver who STOPs a
 * Grabba campaign stops receiving TopTier dispatch offers, because every
 * brand leaves from the same shared number and opt_out_events has no program
 * scope. That behaviour is CORRECT and DELIBERATE — but it must not be
 * silent: dispatch skips him, he stops getting offers, and "is he
 * suppressed or just unavailable?" becomes unanswerable.
 *
 * So every converted dispatch/transactional send that comes back `blocked`
 * from send-sms calls this: one row in tt_notifications_log (type
 * 'dispatch_suppressed' for workforce, 'customer_sms_suppressed' for
 * transactional) naming the recipient, the booking, and the reason. The
 * caller ALSO includes the skip in its own return payload. No alert is
 * fired — one skipped driver is not an incident, but a pattern of them is,
 * and the rows make the pattern queryable:
 *
 *   select recipient, count(*)
 *   from tt_notifications_log
 *   where type = 'dispatch_suppressed'
 *   group by recipient order by 2 desc;
 */

export interface DispatchSuppressedOpts {
  bookingId?: string | null;
  bookingReference?: string | null;
  recipientPhone: string;
  recipientName?: string | null;
  partnerId?: string | null;
  sendClass: "workforce" | "transactional";
  /** The reason string from the send result (e.g. "sms_stop:opt_out_events"). */
  reason: string;
  /** Suppression source (legal_stop, dnc_list, ...). */
  source?: string | null;
  /** Override the notifications_log type when the default doesn't fit. */
  outcomeType?: string;
}

export async function recordDispatchSuppressed(
  supabase: any,
  opts: DispatchSuppressedOpts,
): Promise<void> {
  const type =
    opts.outcomeType ??
    (opts.sendClass === "workforce" ? "dispatch_suppressed" : "customer_sms_suppressed");
  const who = opts.recipientName
    ? `${opts.recipientName} (${opts.recipientPhone})`
    : opts.recipientPhone;
  const followUp =
    opts.sendClass === "workforce"
      ? "Driver/partner will NOT see this offer — re-onboard or contact directly."
      : "Customer did not receive this transactional message.";
  try {
    await supabase.from("tt_notifications_log").insert({
      booking_id: opts.bookingId ?? null,
      type,
      channel: "sms",
      recipient: opts.recipientPhone,
      status: "blocked",
      message:
        `Suppressed ${opts.sendClass} SMS to ${who}` +
        (opts.bookingReference ? ` for ${opts.bookingReference}` : "") +
        ` — ${opts.source || "suppression"}: ${opts.reason}. ${followUp}` +
        (opts.partnerId ? ` partner_id=${opts.partnerId}` : ""),
    });
  } catch (e) {
    // Visibility must never break dispatch itself.
    console.error("[dispatchOutcome] log insert failed:", (e as Error).message);
  }
}
