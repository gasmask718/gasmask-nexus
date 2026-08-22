/**
 * StoreAccountBriefing — ACCOUNT MANAGER BRIEFING panel.
 *
 * Reads the cached briefing from v_store_briefing_input on load (no API call).
 * "Analyze this account" / "Refresh" invoke the store-account-briefing edge
 * function, which calls Anthropic and upserts store_ai_briefing.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BrainCircuit, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BriefingRow {
  cached_briefing: string | null;
  analyzed_at: string | null;
  is_stale: boolean | null;
}

function formatAnalyzedAt(iso: string): string {
  // "22 August 2026, 3:14pm"
  return format(new Date(iso), 'd MMMM yyyy, h:mma').replace(/(AM|PM)$/, (m) => m.toLowerCase());
}

export function StoreAccountBriefing({ storeId }: { storeId: string }) {
  const { storeMasterId } = useStoreMasterResolver(storeId);
  const queryClient = useQueryClient();
  const [briefingOverride, setBriefingOverride] = useState<{ briefing: string; analyzed_at: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['store-briefing', storeMasterId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_store_briefing_input')
        .select('cached_briefing, analyzed_at, is_stale')
        .eq('store_id', storeMasterId)
        .maybeSingle();
      if (error) throw error;
      return data as BriefingRow | null;
    },
    enabled: !!storeMasterId,
    staleTime: 5 * 60 * 1000,
  });

  const analyze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('store-account-briefing', {
        body: { store_id: storeMasterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { briefing: string; analyzed_at: string; refresh_count: number };
    },
    onSuccess: (result) => {
      setBriefingOverride({ briefing: result.briefing, analyzed_at: result.analyzed_at });
      queryClient.invalidateQueries({ queryKey: ['store-briefing', storeMasterId] });
      toast.success('Briefing updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    },
  });

  const briefing = briefingOverride?.briefing ?? data?.cached_briefing ?? null;
  const analyzedAt = briefingOverride?.analyzed_at ?? data?.analyzed_at ?? null;
  const isStale = !briefingOverride && (data?.is_stale ?? false);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
            Account Manager Briefing
          </CardTitle>
          <div className="flex items-center gap-2">
            {isStale && briefing && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-500 text-[10px]">
                New activity since this was written
              </Badge>
            )}
            {briefing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => analyze.mutate()}
                disabled={analyze.isPending}
              >
                {analyze.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span className="ml-1">Refresh</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => analyze.mutate()}
                disabled={analyze.isPending || !storeMasterId}
              >
                {analyze.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Analyze this account
              </Button>
            )}
          </div>
        </div>
        {analyzedAt && (
          <p className="text-xs text-muted-foreground">Last analyzed: {formatAnalyzedAt(analyzedAt)}</p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading briefing…
          </div>
        ) : briefing ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{briefing}</p>
        ) : (
          !analyze.isPending && (
            <p className="text-sm text-muted-foreground">
              No briefing yet. Analyze this account for a plain-English summary of what has
              happened, what has changed, and what needs doing.
            </p>
          )
        )}
        {analyze.isPending && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the account…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
