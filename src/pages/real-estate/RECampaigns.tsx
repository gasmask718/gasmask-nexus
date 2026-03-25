import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Phone, Plus } from 'lucide-react';

export default function RECampaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('ai_call_campaigns')
      .select('*')
      .or('name.ilike.%real estate%,name.ilike.%dynasty property%,target_segment.eq.Dynasty Real Estate')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setCampaigns(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Campaigns</h1>
          <p className="text-muted-foreground">Outbound calling campaigns for seller acquisition</p>
        </div>
        <Button onClick={() => navigate('/dynasty-connect/campaign-builder')} style={{ backgroundColor: '#3B6D11' }}>
          <Plus className="h-4 w-4 mr-2" />New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">Create a campaign from the Lead Pipeline or Dynasty Connect</p>
            <Button onClick={() => navigate('/dynasty-connect/campaign-builder')} style={{ backgroundColor: '#3B6D11' }}>
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.total_targets || 0} targets · {c.completed_calls || 0} completed · {c.conversion_count || 0} conversions
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
