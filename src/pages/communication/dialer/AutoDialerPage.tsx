// Dynasty OS — AutoDialerPage — cache-bust rebuild 2026-03-21T14:30
import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Phone, Headphones, Store, Target, Users, History, Settings, AlertTriangle, Radio, Mic, Disc, PhoneOff, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { VoiceGoLiveReport } from '@/components/communication/VoiceGoLiveReport';

// Tab content components
import DialerStoresTab from './tabs/DialerStoresTab';
import DialerProspectsTab from './tabs/DialerProspectsTab';
import DialerConsoleTab from './tabs/DialerConsoleTab';
import DialerHistoryTab from './tabs/DialerHistoryTab';
import DialerCampaignsTab from './tabs/DialerCampaignsTab';
import DialerLiveCallsTab from './tabs/DialerLiveCallsTab';
import CallRecordingsTab from '@/components/dialer/CallRecordingsTab';
import MissedCallsTab from '@/components/dialer/MissedCallsTab';
import DialerPriorCustomersTab from './tabs/DialerPriorCustomersTab';
import { usePriorCustomerSegmentMap } from '@/hooks/usePriorCustomerSegmentMap';

export default function AutoDialerPage() {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const [activeTab, setActiveTab] = useState('console');
  const { counts: priorCustomerCounts } = usePriorCustomerSegmentMap();

  // Status banner data
  const { data: queueCount = 0 } = useQuery({
    queryKey: ['ad-queue-count', bizId],
    queryFn: async () => {
      const { count } = await supabase
        .from('outbound_call_queue')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
        .eq('status', 'queued');
      return count || 0;
    },
    enabled: !!bizId,
    refetchInterval: 5000,
  });

  const { data: agentCount = 0 } = useQuery({
    queryKey: ['ad-agent-count', bizId],
    queryFn: async () => {
      const { count } = await supabase
        .from('dialer_agent_availability')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
        .eq('status', 'available');
      return count || 0;
    },
    enabled: !!bizId,
    refetchInterval: 5000,
  });

  const { data: activeCampaigns = 0 } = useQuery({
    queryKey: ['ad-campaign-count', bizId],
    queryFn: async () => {
      const { count } = await supabase
        .from('dialer_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
        .eq('status', 'active');
      return count || 0;
    },
    enabled: !!bizId,
  });

  return (
    <div className="w-full min-h-full space-y-4">
      {/* Header + Status Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" /> Auto Dialer
          </h1>
          <p className="text-sm text-muted-foreground">
            Command center — build lists, launch campaigns, run calls.
          </p>
        </div>

        {/* Live status indicators */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-xs">
            <div className={`h-2 w-2 rounded-full ${queueCount > 0 ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            Queue: {queueCount}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <div className={`h-2 w-2 rounded-full ${agentCount > 0 ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            Agents: {agentCount}
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            Campaigns: {activeCampaigns}
          </Badge>
          {queueCount > 0 && agentCount === 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" /> No agents ready
            </Badge>
          )}
        </div>
      </div>

      {/* Tabbed Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="console" className="gap-1.5 text-xs">
            <Headphones className="h-3.5 w-3.5" /> Console
          </TabsTrigger>
          <TabsTrigger value="stores" className="gap-1.5 text-xs">
            <Store className="h-3.5 w-3.5" /> Active Stores
          </TabsTrigger>
          <TabsTrigger value="prospects" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> Prospects
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> History
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5 text-xs">
            <Radio className="h-3.5 w-3.5" /> Live Calls
          </TabsTrigger>
          <TabsTrigger value="recordings" className="gap-1.5 text-xs">
            <Disc className="h-3.5 w-3.5" /> Recordings
          </TabsTrigger>
          <TabsTrigger value="missed" className="gap-1.5 text-xs">
            <PhoneOff className="h-3.5 w-3.5" /> Missed
          </TabsTrigger>
          <TabsTrigger value="voice-status" className="gap-1.5 text-xs">
            <Mic className="h-3.5 w-3.5" /> Voice Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="mt-4">
          <DialerConsoleTab />
        </TabsContent>
        <TabsContent value="stores" className="mt-4">
          <DialerStoresTab />
        </TabsContent>
        <TabsContent value="prospects" className="mt-4">
          <DialerProspectsTab />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <DialerCampaignsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <DialerHistoryTab />
        </TabsContent>
        <TabsContent value="live" className="mt-4">
          <DialerLiveCallsTab />
        </TabsContent>
        <TabsContent value="recordings" className="mt-4">
          <CallRecordingsTab />
        </TabsContent>
        <TabsContent value="missed" className="mt-4">
          <MissedCallsTab />
        </TabsContent>
        <TabsContent value="voice-status" className="mt-4">
          <div className="max-w-2xl">
            <VoiceGoLiveReport />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
