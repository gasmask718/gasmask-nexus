/**
 * Phase D-OS — AI Ops tunables.
 *
 * Edit-and-deploy switches; no DB migration required. Mirror these values
 * in the edge functions when they need to enforce caps server-side.
 */
export const AI_OPS = {
  reorderNudges: {
    /**
     * If false (default), cron writes drafts into communication_drafts and
     * a human approves/sends them from the messaging hub. Flip to true
     * once the copy quality is proven (~1 week of drafts).
     */
    autoSend: false,

    /** Max nudges queued per supplier per rolling 24h window. */
    perSupplierDailyCap: 1,

    /** Below-or-equal reorder_point triggers a nudge candidate. */
    reorderPointMultiplier: 1.0,

    /** SMS body cap (Twilio safe; nudges should fit in 1 segment when possible). */
    bodyMaxChars: 320,

    /** Skip if a nudge for this supplier was sent or drafted within (hours). */
    cooldownHours: 24,
  },

  anomalyScan: {
    /** Cron runs daily — UTC hour (24h). 06:00 UTC ≈ 1–2am ET. */
    cronHourUtc: 6,

    /** Day-over-day spike threshold flagged as a warn-tone anomaly. */
    spikeMultiplier: 3.0,

    /** Lookback window for the duplicate-cluster detector (hours). */
    duplicateClusterWindowHours: 6,
  },

  reorderNudgeSend: {
    /** Cron-driven SEND window (UTC). Drafts compute nightly; sends fire here. */
    cronHourUtc: 14,                 // ~9–10am ET
    weekendSend: false,              // never SMS Sat/Sun
  },

  triage: {
    /** Score thresholds for color/severity in the queue. */
    autoTriageOnLoad: true,          // run triage for any pending app without a score
    legitGreen: 70,
    legitAmber: 40,
  },

  outreach: {
    /** Never auto-send. Operator always reviews. */
    requireHumanReview: true,
    smsMaxChars: 320,
  },
} as const;

export type AiOpsConfig = typeof AI_OPS;
