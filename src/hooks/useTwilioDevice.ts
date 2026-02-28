/**
 * useTwilioDevice — DEPRECATED thin re-export of VoiceDeviceProvider.
 * Prefer importing useVoiceDevice directly from @/contexts/VoiceDeviceProvider.
 */

import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";

export type { VoiceHealth, DeviceLifecycleState, MicPermission, VoiceDeviceContextValue } from "@/contexts/VoiceDeviceProvider";

/** @deprecated Use useVoiceDevice() from @/contexts/VoiceDeviceProvider */
export function useTwilioDevice() {
  return useVoiceDevice();
}
