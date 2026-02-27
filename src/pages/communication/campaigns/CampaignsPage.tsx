import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, BarChart3, Target, Users } from 'lucide-react';
import AutoCampaigns from "@/components/communication/AutoCampaigns";
import ColdCallBlastPage from '@/pages/communication/cold-calls/ColdCallBlastPage';
import CampaignIntelligencePage from '@/pages/communication/dialer/CampaignIntelligencePage';

export default function CampaignsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'builder';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" /> Campaigns
        </h2>
        <p className="text-muted-foreground">Build, analyze, and blast campaigns</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="builder" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" /> Builder
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="cold-blast" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> Cold Call Blast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          <AutoCampaigns />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <CampaignIntelligencePage />
        </TabsContent>
        <TabsContent value="cold-blast" className="mt-4">
          <ColdCallBlastPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
