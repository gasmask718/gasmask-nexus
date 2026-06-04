import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Radar, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  neighborhoodId: string;
  neighborhoodName: string;
}

export function NeighborhoodScanButton({ neighborhoodId, neighborhoodName }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [force, setForce] = useState(false);

  // Last scan summary
  const { data: lastScan } = useQuery({
    queryKey: ['gm-last-scan', neighborhoodId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gm_neighborhood_scans')
        .select('*')
        .eq('neighborhood_id', neighborhoodId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  // Unmatched POIs cache
  const { data: pois } = useQuery({
    queryKey: ['gm-pois', neighborhoodId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gm_discovered_pois')
        .select('*')
        .eq('neighborhood_id', neighborhoodId)
        .is('matched_store_id', null)
        .order('first_seen_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: open,
  });

  const runScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('gm-neighborhood-scan', {
        body: { neighborhood_id: neighborhoodId, force },
      });
      if (error) throw error;
      setResult(data);
      if (data?.guarded) {
        toast.info(data.message);
      } else if (data?.ok) {
        toast.success(`Scan complete: ${data.pois_found} POIs found, ${data.new_prospects} new prospects`);
        qc.invalidateQueries({ queryKey: ['gm-last-scan', neighborhoodId] });
        qc.invalidateQueries({ queryKey: ['gm-pois', neighborhoodId] });
      }
    } catch (e: any) {
      toast.error(e.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Radar className="h-3 w-3 mr-1" />
        Scan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5" />
              Scan {neighborhoodName} for missing stores
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pulls smoke shop · convenience · deli · bodega POIs from Google Places, diffs against
              our store master, and writes any unknown locations to <strong>sales_prospects</strong>{' '}
              tagged <code className="text-xs">gm_gap_scan</code>. 30-day re-scan guard active.
            </p>

            {lastScan && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Last scan:</span>
                    <span className="text-muted-foreground">
                      {new Date(lastScan.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">
                    Found {lastScan.pois_found} POIs · matched {lastScan.pois_matched} · created{' '}
                    {lastScan.new_prospects} new prospects
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={runScan} disabled={scanning}>
                {scanning ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</>
                ) : (
                  <><Radar className="h-4 w-4 mr-2" /> Run scan</>
                )}
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                Force (bypass 30-day guard)
              </label>
            </div>

            {result?.guarded && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <span>{result.message}</span>
              </div>
            )}

            {result?.ok && (
              <Card>
                <CardContent className="p-3 text-sm">
                  <strong>Scan result:</strong> {result.pois_found} POIs · {result.pois_matched} matched ·{' '}
                  <strong className="text-green-500">{result.new_prospects} new prospects</strong>
                </CardContent>
              </Card>
            )}

            {pois && pois.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">External POIs not in our universe ({pois.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {pois.slice(0, 25).map((p: any) => (
                    <div key={p.id} className="flex items-start justify-between p-2 rounded hover:bg-muted/30 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                        {p.promoted_prospect_id && (
                          <Badge variant="secondary" className="text-[10px]">prospect</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
