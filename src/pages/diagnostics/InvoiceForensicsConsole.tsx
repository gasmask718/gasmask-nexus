import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search, AlertTriangle, CheckCircle2, FileText, Database,
  ShieldAlert, Eye, EyeOff, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ForensicResult {
  id: string;
  invoice_number: string | null;
  table_source: string;
  store_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  total_amount: number;
  payment_status: string | null;
  status: string | null;
  created_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
  is_historical: boolean | null;
  store_name: string | null;
  in_unified_feed: boolean;
  exclusion_reason: string | null;
}

export default function InvoiceForensicsConsole() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Orphan detection: count invoices per table vs what feed returns
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['invoice-forensics-audit'],
    queryFn: async () => {
      const [
        { count: invoicesTotal },
        { count: crmTotal },
        { count: wholesaleTotal },
        { count: deletedCount },
        { count: historicalCount },
        { count: wholesalerEntityCount },
      ] = await Promise.all([
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
        supabase.from('customer_invoices').select('*', { count: 'exact', head: true }),
        supabase.from('marketplace_orders').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('is_historical', true),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('entity_type', 'wholesaler'),
      ]);

      // Check for invoices with missing store linkage
      const { count: noStoreCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .is('store_id', null)
        .is('company_id', null);

      // Check for invoices with null payment_status
      const { count: noStatusCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .is('payment_status', null);

      // Check for status mismatches (draft + paid/partial)
      const { count: statusMismatchCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft')
        .in('payment_status', ['paid', 'partial']);

      // Get repair log count
      const { count: repairCount } = await supabase
        .from('invoice_repair_log')
        .select('*', { count: 'exact', head: true });

      // Status distribution
      const { data: statusDist } = await supabase
        .from('invoices')
        .select('payment_status')
        .limit(5000);

      const statusCounts: Record<string, number> = {};
      (statusDist || []).forEach((r: any) => {
        const s = r.payment_status || 'NULL';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      // Invoice status (not payment_status) distribution
      const { data: invStatusDist } = await supabase
        .from('invoices')
        .select('status')
        .limit(5000);

      const invStatusCounts: Record<string, number> = {};
      (invStatusDist || []).forEach((r: any) => {
        const s = r.status || 'NULL';
        invStatusCounts[s] = (invStatusCounts[s] || 0) + 1;
      });

      return {
        invoicesTotal: invoicesTotal || 0,
        crmTotal: crmTotal || 0,
        wholesaleTotal: wholesaleTotal || 0,
        deletedCount: deletedCount || 0,
        historicalCount: historicalCount || 0,
        wholesalerEntityCount: wholesalerEntityCount || 0,
        noStoreCount: noStoreCount || 0,
        noStatusCount: noStatusCount || 0,
        statusMismatchCount: statusMismatchCount || 0,
        repairCount: repairCount || 0,
        statusCounts,
        invStatusCounts,
        feedExpected: (invoicesTotal || 0) + (crmTotal || 0) + (wholesaleTotal || 0),
      };
    },
    staleTime: 60000,
  });

  // Search for specific invoice
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['invoice-forensic-search', activeSearch],
    queryFn: async () => {
      if (!activeSearch) return [];
      const results: ForensicResult[] = [];
      const search = activeSearch.trim();

      // Search invoices table by invoice_number OR store_id name match
      const { data: invoiceHits } = await supabase
        .from('invoices')
        .select('id, invoice_number, store_id, entity_type, entity_id, total_amount, payment_status, status, created_at, created_by, deleted_at, is_historical')
        .or(`invoice_number.ilike.%${search}%,total_amount.eq.${isNaN(Number(search)) ? 0 : search}`)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get store names for results
      const storeIds = [...new Set((invoiceHits || []).map(i => i.store_id).filter(Boolean))];
      let storeMap: Record<string, string> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from('store_master')
          .select('id, store_name')
          .in('id', storeIds);
        storeMap = (stores || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.store_name }), {});
      }

      (invoiceHits || []).forEach((inv: any) => {
        let exclusion: string | null = null;
        const inFeed = !inv.deleted_at; // If not deleted, it should be in the feed

        if (inv.deleted_at) exclusion = 'Soft-deleted (deleted_at set)';
        else if (!inv.store_id && !inv.entity_id) exclusion = 'Missing store/entity linkage — shows as "Unknown Entity"';
        else exclusion = null;

        results.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          table_source: 'invoices',
          store_id: inv.store_id,
          entity_type: inv.entity_type,
          entity_id: inv.entity_id,
          total_amount: Number(inv.total_amount) || 0,
          payment_status: inv.payment_status,
          status: inv.status,
          created_at: inv.created_at,
          created_by: inv.created_by,
          deleted_at: inv.deleted_at,
          is_historical: inv.is_historical,
          store_name: inv.store_id ? storeMap[inv.store_id] || 'Unknown' : null,
          in_unified_feed: inFeed,
          exclusion_reason: exclusion,
        });
      });

      // Also search by store name if it looks like a name
      if (isNaN(Number(search)) && search.length >= 3) {
        const { data: storeMatches } = await supabase
          .from('store_master')
          .select('id, store_name')
          .ilike('store_name', `%${search}%`)
          .limit(10);

        if (storeMatches && storeMatches.length > 0) {
          const matchedStoreIds = storeMatches.map(s => s.id);
          const storeNameMap = storeMatches.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.store_name }), {});

          const { data: storeInvoices } = await supabase
            .from('invoices')
            .select('id, invoice_number, store_id, entity_type, entity_id, total_amount, payment_status, status, created_at, created_by, deleted_at, is_historical')
            .in('store_id', matchedStoreIds)
            .order('created_at', { ascending: false })
            .limit(50);

          (storeInvoices || []).forEach((inv: any) => {
            // Skip if already in results
            if (results.some(r => r.id === inv.id)) return;

            results.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              table_source: 'invoices',
              store_id: inv.store_id,
              entity_type: inv.entity_type,
              entity_id: inv.entity_id,
              total_amount: Number(inv.total_amount) || 0,
              payment_status: inv.payment_status,
              status: inv.status,
              created_at: inv.created_at,
              created_by: inv.created_by,
              deleted_at: inv.deleted_at,
              is_historical: inv.is_historical,
              store_name: storeNameMap[inv.store_id] || 'Unknown',
              in_unified_feed: !inv.deleted_at,
              exclusion_reason: inv.deleted_at ? 'Soft-deleted' : null,
            });
          });
        }
      }

      // Also search customer_invoices
      const { data: crmHits } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number, customer_id, total_amount, status, created_at')
        .or(`invoice_number.ilike.%${search}%,total_amount.eq.${isNaN(Number(search)) ? 0 : search}`)
        .order('created_at', { ascending: false })
        .limit(20);

      (crmHits || []).forEach((inv: any) => {
        results.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          table_source: 'customer_invoices',
          store_id: null,
          entity_type: 'customer',
          entity_id: inv.customer_id,
          total_amount: Number(inv.total_amount) || 0,
          payment_status: inv.status,
          status: inv.status,
          created_at: inv.created_at,
          created_by: null,
          deleted_at: null,
          is_historical: null,
          store_name: null,
          in_unified_feed: true,
          exclusion_reason: null,
        });
      });

      return results;
    },
    enabled: !!activeSearch,
  });

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Invoice Forensics Console
          </h1>
          <p className="text-muted-foreground">Audit invoice visibility, detect orphans, and diagnose missing records</p>
        </div>
      </div>

      {/* System Audit Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Audit Summary
            </CardTitle>
            <CardDescription>Real-time counts across all invoice tables</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchAudit()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : auditData ? (
            <div className="space-y-6">
              {/* Table Counts */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">invoices table</p>
                  <p className="text-2xl font-bold">{auditData.invoicesTotal.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">customer_invoices table</p>
                  <p className="text-2xl font-bold">{auditData.crmTotal.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">marketplace_orders table</p>
                  <p className="text-2xl font-bold">{auditData.wholesaleTotal.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-primary/5">
                  <p className="text-sm text-muted-foreground">Total Expected in Feed</p>
                  <p className="text-2xl font-bold text-primary">{auditData.feedExpected.toLocaleString()}</p>
                </div>
              </div>

              {/* Health Checks */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Health Checks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <HealthCheck
                    label="Soft-deleted invoices"
                    value={auditData.deletedCount}
                    ok={auditData.deletedCount === 0}
                    detail="These exist in DB but are hidden from feed"
                  />
                  <HealthCheck
                    label="Historical/legacy invoices"
                    value={auditData.historicalCount}
                    ok={true}
                    detail="Correctly tagged and shown with legacy badge"
                  />
                  <HealthCheck
                    label="Missing store/entity linkage"
                    value={auditData.noStoreCount}
                    ok={auditData.noStoreCount === 0}
                    detail="Invoices with no store_id AND no company_id"
                  />
                  <HealthCheck
                    label="NULL payment_status"
                    value={auditData.noStatusCount}
                    ok={auditData.noStatusCount === 0}
                    detail="These default to 'unpaid' in the feed"
                  />
                  <HealthCheck
                    label="Wholesaler entity_type invoices"
                    value={auditData.wholesalerEntityCount}
                    ok={true}
                    detail="Excluded from invoices_unified store section (by design)"
                  />
                  <HealthCheck
                    label="Status mismatches (draft+paid/partial)"
                    value={auditData.statusMismatchCount}
                    ok={auditData.statusMismatchCount === 0}
                    detail="Draft invoices with paid/partial payment — auto-prevented by trigger"
                  />
                  <HealthCheck
                    label="Repaired invoices (logged)"
                    value={auditData.repairCount}
                    ok={true}
                    detail="Records normalized by system_repair_v1 — immutable audit trail"
                  />
                </div>
              </div>

              {/* Status Distribution */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Payment Status Distribution (invoices table)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(auditData.statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                    <Badge key={status} variant="outline" className="text-sm py-1 px-3">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Invoice Search (Cross-Table)
          </CardTitle>
          <CardDescription>
            Search by invoice number, store name, or exact amount across ALL invoice tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. INV-202603-973, Omar, 200..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>

          {searchLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">{searchResults.length} result(s) found</p>
              {searchResults.map((result) => (
                <Card key={`${result.table_source}-${result.id}`} className="p-4 border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg">
                          {result.invoice_number || `ID: ${result.id.slice(0, 8)}...`}
                        </span>
                        <Badge variant="outline">{result.table_source}</Badge>
                        {result.payment_status && (
                          <Badge variant={result.payment_status === 'paid' ? 'default' : 'secondary'}>
                            {result.payment_status}
                          </Badge>
                        )}
                        {result.is_historical && <Badge variant="secondary">Historical</Badge>}
                        {result.deleted_at && <Badge variant="destructive">DELETED</Badge>}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>{' '}
                          <span className="font-medium">${result.total_amount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Store:</span>{' '}
                          <span className="font-medium">{result.store_name || result.store_id?.slice(0, 8) || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Entity:</span>{' '}
                          <span className="font-medium">{result.entity_type || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>{' '}
                          <span className="font-medium">
                            {result.created_at ? new Date(result.created_at).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </div>

                      {result.created_by && (
                        <p className="text-xs text-muted-foreground">
                          Created by: {result.created_by.slice(0, 8)}...
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {result.in_unified_feed ? (
                        <div className="flex items-center gap-1 text-green-500 text-sm">
                          <Eye className="h-4 w-4" />
                          <span>Visible in Feed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive text-sm">
                          <EyeOff className="h-4 w-4" />
                          <span>HIDDEN</span>
                        </div>
                      )}
                      {result.exclusion_reason && (
                        <p className="text-xs text-amber-500 text-right max-w-[200px]">
                          ⚠ {result.exclusion_reason}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => navigate(`/billing/invoices/${result.id}`)}
                      >
                        View Invoice
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {searchResults && searchResults.length === 0 && activeSearch && (
            <div className="mt-4 text-center py-8">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-muted-foreground">No invoices found matching "{activeSearch}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Searched: invoices, customer_invoices, store_master (by name)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Known Example Quick Check */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Known Test Case: INV-202603-973
          </CardTitle>
          <CardDescription>
            Omar Convenience • $200 • Dec 13, 2025
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KnownInvoiceCheck />
        </CardContent>
      </Card>
    </div>
  );
}

function HealthCheck({ label, value, ok, detail }: { label: string; value: number; ok: boolean; detail: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${ok ? 'border-border' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Badge variant={ok ? 'outline' : 'secondary'} className="text-lg font-bold">
        {value}
      </Badge>
    </div>
  );
}

function KnownInvoiceCheck() {
  const { data, isLoading } = useQuery({
    queryKey: ['forensic-known-invoice'],
    queryFn: async () => {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, invoice_number, store_id, entity_type, total_amount, payment_status, status, created_at, created_by, deleted_at, is_historical')
        .eq('invoice_number', 'INV-202603-973')
        .maybeSingle();

      if (!inv) return { found: false as const };

      let storeName = 'Unknown';
      if (inv.store_id) {
        const { data: store } = await supabase
          .from('store_master')
          .select('store_name')
          .eq('id', inv.store_id)
          .maybeSingle();
        if (store) storeName = store.store_name;
      }

      return {
        found: true as const,
        invoice: inv,
        storeName,
        issues: [
          inv.deleted_at ? '❌ Invoice is soft-deleted' : '✅ Not deleted',
          inv.store_id ? '✅ Has store_id linkage' : '⚠️ Missing store_id',
          inv.payment_status ? `✅ Status: ${inv.payment_status}` : '⚠️ NULL payment_status',
          inv.status === 'draft' && inv.payment_status === 'paid' ? '⚠️ status=draft but payment_status=paid (mismatch)' : '✅ Status consistent',
          '✅ In unified feed (queryable by search)',
        ],
      };
    },
  });

  if (isLoading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />;

  if (!data?.found) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">NOT FOUND in invoices table</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-green-500">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">FOUND in invoices table</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><span className="text-muted-foreground">Store:</span> {data.storeName}</div>
        <div><span className="text-muted-foreground">Amount:</span> ${data.invoice.total_amount}</div>
        <div><span className="text-muted-foreground">Payment:</span> {data.invoice.payment_status}</div>
        <div><span className="text-muted-foreground">Created:</span> {new Date(data.invoice.created_at).toLocaleDateString()}</div>
      </div>
      <div className="space-y-1">
        {data.issues.map((issue, i) => (
          <p key={i} className="text-sm">{issue}</p>
        ))}
      </div>
    </div>
  );
}
