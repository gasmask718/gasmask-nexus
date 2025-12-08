// ═══════════════════════════════════════════════════════════════════════════════
// STORE FOLLOW-UP SECTION — Shows follow-up timeline + next follow-up in store profile
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';
import { useStoreFollowUps, useNextStoreFollowUp } from '@/hooks/useStoreFollowUps';
import { triggerFollowUp } from '@/services/followUpTriggerService';
import { NextFollowUpBanner } from './NextFollowUpBanner';
import { FollowUpTimeline } from './FollowUpTimeline';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface StoreFollowUpSectionProps {
  storeId: string;
}

export function StoreFollowUpSection({ storeId }: StoreFollowUpSectionProps) {
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: followUps = [], isLoading } = useStoreFollowUps(storeId);
  const { data: nextFollowUp } = useNextStoreFollowUp(storeId);

  const handleTrigger = async (id: string) => {
    const followUp = followUps.find((f) => f.id === id) || nextFollowUp;
    if (!followUp) return;

    setIsTriggering(true);
    try {
      const result = await triggerFollowUp(followUp);
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['store-follow-ups', storeId] });
        queryClient.invalidateQueries({ queryKey: ['store-next-follow-up', storeId] });
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to trigger follow-up');
    } finally {
      setIsTriggering(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Follow-Ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Next Follow-Up Banner */}
      <NextFollowUpBanner
        followUp={nextFollowUp || null}
        onTrigger={handleTrigger}
        isLoading={isTriggering}
      />

      {/* Follow-Up Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Follow-Up History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FollowUpTimeline followUps={followUps} />
        </CardContent>
      </Card>
    </div>
  );
}
