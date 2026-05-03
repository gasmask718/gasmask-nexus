import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Download, ShieldAlert, Loader2 } from 'lucide-react';
import { exportData } from '@/utils/exportUtils';

interface DuplicateGroup {
  duplicate_group_id: number;
  normalized_address: string;
  store_count: number;
  store_ids: string[];
  store_names: (string | null)[];
  raw_addresses: (string | null)[];
  phones: (string | null)[];
  created_dates: string[];
}

export default function StoreDeduplicationPage() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: groups, isLoading, error } = useQuery({
    queryKey: ['store-duplicates'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('detect_store_address_duplicates');
      if (error) throw error;
      return (data ?? []) as DuplicateGroup[];
    },
  });

  const { data: totalStores } = useQuery({
    queryKey: ['store-total-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const stats = useMemo(() => {
    if (!groups) return { groupCount: 0, storesInDupes: 0 };
    return {
      groupCount: groups.length,
      storesInDupes: groups.reduce((sum, g) => sum + Number(g.store_count), 0),
    };
  }, [groups]);

  const handleDownloadCsv = () => {
    if (!groups || groups.length === 0) return;
    const rows: Record<string, unknown>[] = [];
    groups.forEach((g) => {
      g.store_ids.forEach((sid, idx) => {
        rows.push({
          duplicate_group_id: g.duplicate_group_id,
          normalized_address: g.normalized_address,
          store_count_in_group: g.store_count,
          store_id: sid,
          store_name: g.store_names[idx] ?? '',
          raw_address: g.raw_addresses[idx] ?? '',
          phone: g.phones[idx] ?? '',
          created_at: g.created_dates[idx] ?? '',
        });
      });
    });
    const today = new Date().toISOString().slice(0, 10);
    exportData({ filename: `store_duplicates_${today}`, format: 'csv', data: rows });
  };

  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Deduplication — Detection Report</h1>
          <p className="text-muted-foreground mt-1">
            Identifies stores in the directory whose normalized addresses appear to match.
          </p>
        </div>
        <Button onClick={handleDownloadCsv} disabled={!groups?.length}>
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>READ-ONLY REPORT</AlertTitle>
        <AlertDescription>
          No store records have been changed. Review the duplicate groups below and decide which to merge in Phase B.
          Records with apartment / unit / suite designations are excluded from automatic grouping.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total stores in directory</CardDescription>
            <CardTitle className="text-3xl">{totalStores?.toLocaleString() ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duplicate groups detected</CardDescription>
            <CardTitle className="text-3xl">{stats.groupCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stores involved in duplicates</CardDescription>
            <CardTitle className="text-3xl">{stats.storesInDupes.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate Groups</CardTitle>
          <CardDescription>Sorted by group size (largest first). Click a row to expand.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Scanning store directory…
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Failed to load duplicates</AlertTitle>
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && groups && groups.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No duplicate groups detected. 🎉</p>
          )}
          {!isLoading && groups && groups.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-20">Group</TableHead>
                  <TableHead>Normalized Address</TableHead>
                  <TableHead className="w-32 text-right">Duplicates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <Collapsible
                    key={g.duplicate_group_id}
                    open={!!expanded[g.duplicate_group_id]}
                    onOpenChange={() => toggle(g.duplicate_group_id)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer">
                          <TableCell>
                            {expanded[g.duplicate_group_id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">#{g.duplicate_group_id}</TableCell>
                          <TableCell className="font-medium">{g.normalized_address}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{g.store_count}</Badge>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Store ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Raw Address</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Created</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {g.store_ids.map((sid, idx) => (
                                    <TableRow key={sid}>
                                      <TableCell className="font-mono text-xs">{sid.slice(0, 8)}…</TableCell>
                                      <TableCell>{g.store_names[idx] ?? '—'}</TableCell>
                                      <TableCell>{g.raw_addresses[idx] ?? '—'}</TableCell>
                                      <TableCell>{g.phones[idx] ?? '—'}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {g.created_dates[idx]
                                          ? new Date(g.created_dates[idx]).toLocaleDateString()
                                          : '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
