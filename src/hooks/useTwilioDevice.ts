/**
 * useTwilioDevice — thin subscriber to the global VoiceDeviceProvider.
 * 
 * NO device creation happens here. All state comes from context.
 * Kept for backward-compatibility with existing consumers.
 */

import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";

// Re-export types from the provider
export type { VoiceHealth, DeviceLifecycleState, VoiceDeviceContextValue } from "@/contexts/VoiceDeviceProvider";

export function useTwilioDevice() {
  return useVoiceDevice();
}
