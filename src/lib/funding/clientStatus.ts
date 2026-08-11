/**
 * Client-safe presentation layer for funding/grant application statuses.
 *
 * We do NOT invent new database enums. `funding_applications.status` is free
 * text written by staff and the automation engine; this module maps whatever
 * the backend stores into a small, stable set of client-facing display states.
 */

export type ClientDisplayStatus =
  | "PROFILE_INCOMPLETE"
  | "READY_FOR_REVIEW"
  | "MATCHING"
  | "MATCHED"
  | "APPLICATION_PREPARING"
  | "ACTION_REQUIRED"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ADDITIONAL_DOCUMENTS_REQUIRED"
  | "APPROVED"
  | "DECLINED"
  | "FUNDED"
  | "CLOSED";

const RULES: Array<[RegExp, ClientDisplayStatus]> = [
  [/funded|disburs/i, "FUNDED"],
  [/approv/i, "APPROVED"],
  [/declin|denied|reject/i, "DECLINED"],
  [/closed|withdraw|cancel/i, "CLOSED"],
  [/additional[_\s-]?doc|doc(ument)?s?[_\s-]?required|need.*doc/i, "ADDITIONAL_DOCUMENTS_REQUIRED"],
  [/human|checkpoint|action[_\s-]?required|needs[_\s-]?review/i, "ACTION_REQUIRED"],
  [/under[_\s-]?review|pending|in[_\s-]?review|processing/i, "UNDER_REVIEW"],
  [/submitted|sent/i, "SUBMITTED"],
  [/ready[_\s-]?to[_\s-]?submit/i, "READY_TO_SUBMIT"],
  [/preparing|draft|building|package/i, "APPLICATION_PREPARING"],
  [/matched/i, "MATCHED"],
  [/matching/i, "MATCHING"],
  [/ready[_\s-]?for[_\s-]?review/i, "READY_FOR_REVIEW"],
  [/incomplete|intake/i, "PROFILE_INCOMPLETE"],
];

export function toClientDisplayStatus(raw?: string | null): ClientDisplayStatus {
  if (!raw) return "APPLICATION_PREPARING";
  for (const [re, status] of RULES) {
    if (re.test(raw)) return status;
  }
  return "UNDER_REVIEW";
}

export const CLIENT_STATUS_LABEL: Record<ClientDisplayStatus, string> = {
  PROFILE_INCOMPLETE: "Profile Incomplete",
  READY_FOR_REVIEW: "Ready for Review",
  MATCHING: "Matching Lenders",
  MATCHED: "Lender Matched",
  APPLICATION_PREPARING: "Preparing Application",
  ACTION_REQUIRED: "Action Required",
  READY_TO_SUBMIT: "Ready to Submit",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ADDITIONAL_DOCUMENTS_REQUIRED: "Documents Required",
  APPROVED: "Approved",
  DECLINED: "Declined",
  FUNDED: "Funded",
  CLOSED: "Closed",
};

/** Tailwind classes keyed to semantic intent (no hardcoded hex). */
export function clientStatusTone(status: ClientDisplayStatus): string {
  switch (status) {
    case "FUNDED":
    case "APPROVED":
      return "border-emerald-500/30 text-emerald-400";
    case "DECLINED":
    case "CLOSED":
      return "border-destructive/30 text-destructive";
    case "ACTION_REQUIRED":
    case "ADDITIONAL_DOCUMENTS_REQUIRED":
    case "PROFILE_INCOMPLETE":
      return "border-amber-500/40 text-amber-400";
    default:
      return "border-border text-muted-foreground";
  }
}

/** True when the client themselves must do something. */
export function isClientActionRequired(status: ClientDisplayStatus): boolean {
  return (
    status === "ACTION_REQUIRED" ||
    status === "ADDITIONAL_DOCUMENTS_REQUIRED" ||
    status === "PROFILE_INCOMPLETE"
  );
}
