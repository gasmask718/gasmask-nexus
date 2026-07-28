import { Handshake, BadgeCheck, PhoneOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { StoreContactGlance } from '@/hooks/useStoreContactGlance';

/**
 * Minimal at-a-glance markers for the store list card header.
 * Icons only — the list is dense.
 */
export function StoreContactGlanceIcons({ glance }: { glance?: StoreContactGlance }) {
  if (!glance) return null;

  const noGoodNumber = glance.contactCount > 0 && !glance.hasContactableNumber;
  if (!glance.hasHomie && !glance.hasConfirmedOwner && !noGoodNumber) return null;

  return (
    <TooltipProvider>
      <span className="flex items-center gap-1">
        {glance.hasHomie && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Handshake className="h-3.5 w-3.5 text-amber-500" aria-label="Has a homie" />
            </TooltipTrigger>
            <TooltipContent>Has a homie at this store</TooltipContent>
          </Tooltip>
        )}
        {glance.hasConfirmedOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Owner confirmed" />
            </TooltipTrigger>
            <TooltipContent>Owner confirmed</TooltipContent>
          </Tooltip>
        )}
        {noGoodNumber && (
          <Tooltip>
            <TooltipTrigger asChild>
              <PhoneOff className="h-3.5 w-3.5 text-red-500" aria-label="No good number" />
            </TooltipTrigger>
            <TooltipContent>No contactable number — needs a phone fix</TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  );
}
