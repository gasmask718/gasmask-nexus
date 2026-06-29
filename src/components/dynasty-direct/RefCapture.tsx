import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/dynastyDirect/referralCapture";

/** Mount-once helper that latches inbound ?ref=/?store_ref= codes into
 * localStorage so signup flows can apply them later. */
export function RefCapture(): null {
  useEffect(() => { captureReferralFromUrl(); }, []);
  return null;
}
