import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home } from 'lucide-react';

/**
 * Property Detail — reads from re_deals (Real Estate OS).
 * If the deal doesn't exist (or table empty), shows honest empty state and routes back to the RE OS.
 */
export default function OwnerPropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();

  const deal = useQuery({
    queryKey: ['owner-property:deal', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('re_deals')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
            <Home className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Property Detail</h1>
            <p className="text-sm text-muted-foreground">From Real Estate OS · deal id {propertyId}</p>
          </div>
        </div>
      </div>

      {deal.isLoading ? (
        <Card className="rounded-xl"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Loading…</p></CardContent></Card>
      ) : !deal.data ? (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">No deal found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground italic">
              This property id has no record in <code>re_deals</code>. Add deals in the Real Estate OS — this page upgrades automatically.
            </p>
            <Button variant="outline" onClick={() => navigate('/real-estate')}>Open Real Estate OS</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{(deal.data as any).address || (deal.data as any).property_address || 'Unnamed deal'}</span>
              <Badge variant="outline">{(deal.data as any).status || '—'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(deal.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
