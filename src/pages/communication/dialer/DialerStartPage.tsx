import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Rocket, Headphones, Phone, BarChart3, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

export default function DialerStartPage() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;

  const { data: queueCount = 0 } = useQuery({
    queryKey: ['queue-count-start', bizId],
    queryFn: async () => {
      const { count } = await supabase
        .from('outbound_call_queue')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', bizId)
        .eq('status', 'queued');
      return count || 0;
    },
    enabled: !!bizId,
  });

  const { data: activeCampaigns = 0 } = useQuery({
    queryKey: ['active-campaigns-start', bizId],
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

  const tiles = [
    {
      title: 'Build Audience',
      description: 'Filter stores & prospects into callable lists',
      icon: Users,
      path: '/communication/dialer-audience',
      color: 'text-blue-600',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Create Campaign',
      description: 'Set up rules, select audience, and launch',
      icon: Rocket,
      path: '/communication/campaign-wizard',
      color: 'text-purple-600',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Run Console',
      description: `${queueCount} queued · ${activeCampaigns} active campaigns`,
      icon: Headphones,
      path: '/communication/dialer-console',
      color: 'text-green-600',
      bg: 'bg-green-500/10 border-green-500/20',
      primary: true,
    },
    {
      title: 'Bulk Dialer',
      description: 'Legacy predictive bulk dialer interface',
      icon: Phone,
      path: '/communication/bulk-dialer',
      color: 'text-amber-600',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Analytics & Intelligence',
      description: 'Revenue, cost, optimization dashboards',
      icon: BarChart3,
      path: '/communication/revenue-intelligence',
      color: 'text-indigo-600',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Settings',
      description: 'Telephony mode, compliance, agent config',
      icon: Settings,
      path: '/communication/dialer-settings',
      color: 'text-muted-foreground',
      bg: 'bg-muted/50 border-muted',
    },
  ];

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Phone className="h-8 w-8" /> Auto Dialer
        </h1>
        <p className="text-muted-foreground mt-1">
          Build lists, create campaigns, and start calling stores & prospects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(tile => (
          <Card
            key={tile.path}
            className={`cursor-pointer hover:shadow-md transition-all border ${tile.bg} ${tile.primary ? 'ring-2 ring-green-500/30' : ''}`}
            onClick={() => navigate(tile.path)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${tile.bg}`}>
                  <tile.icon className={`h-6 w-6 ${tile.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{tile.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{tile.description}</p>
                  {tile.primary && queueCount > 0 && (
                    <Badge className="mt-2 bg-green-600">{queueCount} ready to dial</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
