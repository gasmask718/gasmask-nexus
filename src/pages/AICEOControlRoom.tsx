import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Brain, Activity } from "lucide-react";
import { DailyOverview } from "@/components/ceo/DailyOverview";
import { BrandPerformance } from "@/components/ceo/BrandPerformance";
import { GrabbaCluster } from "@/components/ceo/GrabbaCluster";
import { AIIntelligenceFeed } from "@/components/ceo/AIIntelligenceFeed";
import { ExcelAnalysisUpload } from "@/components/ceo/ExcelAnalysisUpload";
import { DailyCEOReport } from "@/components/ceo/DailyCEOReport";
import { RegionalHeatMaps } from "@/components/ceo/RegionalHeatMaps";
import { CEOActionItems } from "@/components/ceo/CEOActionItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { brandThemes } from "@/config/brandThemes";

export default function AICEOControlRoom() {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [liveUpdating, setLiveUpdating] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    overview: true,
    brand: true,
    grabba: false,
    maps: false,
    intelligence: true,
    actions: false,
    excel: false,
    report: false
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['ceo-metrics', selectedBrand],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ceo-dashboard-metrics', {
        body: { brand: selectedBrand, timeframe: 'today' }
      });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });

  // Real-time subscriptions
  useEffect(() => {
    setLiveUpdating(true);
    
    const channels = [
      supabase.channel('ceo-orders').on('postgres_changes', 
        { event: '*', schema: 'public', table: 'wholesale_orders' }, 
        () => setLiveUpdating(true)
      ),
      supabase.channel('ceo-stores').on('postgres_changes', 
        { event: '*', schema: 'public', table: 'stores' }, 
        () => setLiveUpdating(true)
      ),
      supabase.channel('ceo-routes').on('postgres_changes', 
        { event: '*', schema: 'public', table: 'routes' }, 
        () => setLiveUpdating(true)
      ),
      supabase.channel('ceo-comms').on('postgres_changes', 
        { event: '*', schema: 'public', table: 'communication_logs' }, 
        () => setLiveUpdating(true)
      ),
      supabase.channel('ceo-automation').on('postgres_changes', 
        { event: '*', schema: 'public', table: 'automation_logs' }, 
        () => setLiveUpdating(true)
      )
    ];

    channels.forEach(channel => channel.subscribe());

    const pulseTimeout = setTimeout(() => setLiveUpdating(false), 2000);

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
      clearTimeout(pulseTimeout);
    };
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                Dynasty CEO Command Center
              </h1>
              <p className="text-muted-foreground mt-2">
                Central intelligence hub for monitoring all operations
              </p>
            </div>
            <div className="flex items-center gap-4">
              {liveUpdating && (
                <Badge variant="outline" className="animate-pulse">
                  <Activity className="h-3 w-3 mr-1" />
                  Live Updating
                </Badge>
              )}
              <div className="flex gap-2 items-center text-sm">
                <span className="font-medium">Revenue Today:</span>
                <span className="text-2xl font-bold text-primary">
                  ${metrics?.metrics?.totalRevenue?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Collapsible 
          open={sectionsOpen.overview} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, overview: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.overview ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Daily Empire Overview</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <DailyOverview metrics={metrics} loading={metricsLoading} />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.brand} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, brand: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.brand ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Brand Performance</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {Object.keys(brandThemes).map(brand => (
                <Button
                  key={brand}
                  variant={selectedBrand === brand ? "default" : "outline"}
                  onClick={() => setSelectedBrand(brand)}
                  size="sm"
                  style={selectedBrand === brand ? {
                    background: brandThemes[brand].gradient,
                    border: 'none'
                  } : undefined}
                >
                  {brandThemes[brand].name}
                </Button>
              ))}
            </div>
            <BrandPerformance brand={selectedBrand} metrics={metrics} />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.grabba} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, grabba: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.grabba ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Grabba Cluster</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <GrabbaCluster />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.maps} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, maps: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.maps ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Regional Heat Maps</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <RegionalHeatMaps />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.intelligence} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, intelligence: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.intelligence ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">AI Intelligence Feed</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <AIIntelligenceFeed expanded />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.actions} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, actions: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.actions ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">CEO Action Items</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <CEOActionItems />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.excel} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, excel: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.excel ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Excel Analysis Engine</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <ExcelAnalysisUpload />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={sectionsOpen.report} 
          onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, report: open }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <ChevronDown className={`h-4 w-4 transition-transform ${sectionsOpen.report ? 'rotate-180' : ''}`} />
            <h2 className="text-xl font-semibold">Daily CEO Report</h2>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <DailyCEOReport />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Layout>
  );
}
