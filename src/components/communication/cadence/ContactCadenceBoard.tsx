// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT CADENCE BOARD — Visibility-First Communication Intelligence
// Shows contact outreach status WITHOUT auto-sending anything
// Supports store-level filtering for drill-down from store profiles
// Dynasty OS Pagination & Verification Contract compliant
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Phone, 
  MessageSquare, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin,
  User,
  Building2,
  X,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  useContactCadenceIntelligence, 
  useRecomputeCadenceStatus,
  type ContactCadenceItem,
  type CadenceFilter,
  PAGE_SIZE_OPTIONS,
} from '@/hooks/useContactCadence';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { ExecutionTarget } from '@/components/communication/followups/FollowUpExecutionBar';

const CADENCE_FILTERS: { value: CadenceFilter; label: string; color?: string }[] = [
  { value: 'all', label: 'All Contacts' },
  { value: 'within_window', label: 'Within Window', color: 'text-green-500' },
  { value: 'due_soon', label: 'Due Soon (7-10 days)', color: 'text-amber-500' },
  { value: 'overdue_7_days', label: 'Overdue 7 Days', color: 'text-orange-500' },
  { value: 'overdue_14_days', label: 'Overdue 14+ Days', color: 'text-red-500' },
  { value: 'never_contacted', label: 'Never Contacted', color: 'text-muted-foreground' },
  { value: 'escalation', label: 'Needs Physical Visit', color: 'text-destructive' },
];

function getCadenceBadge(status: string, escalation: boolean) {
  if (escalation) {
    return <Badge variant="destructive" className="gap-1"><MapPin className="h-3 w-3" /> Visit Required</Badge>;
  }
  
  switch (status) {
    case 'within_window':
      return <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><CheckCircle className="h-3 w-3" /> On Track</Badge>;
    case 'due_soon':
      return <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1"><Clock className="h-3 w-3" /> Due Soon</Badge>;
    case 'overdue_7_days':
      return <Badge variant="outline" className="border-orange-500 text-orange-600 gap-1"><AlertTriangle className="h-3 w-3" /> Overdue 7d</Badge>;
    case 'overdue_14_days':
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overdue 14d+</Badge>;
    case 'never_contacted':
      return <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" /> Never Contacted</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function getResponsivenessBadge(status: string | null, byCall: boolean, byText: boolean) {
  if (status === 'responsive') {
    const methods = [];
    if (byCall) methods.push('📞');
    if (byText) methods.push('💬');
    return <Badge variant="outline" className="border-green-500 text-green-600">{methods.join(' ')} Responsive</Badge>;
  }
  if (status === 'unresponsive') {
    return <Badge variant="outline" className="border-red-500 text-red-600">❌ Unresponsive</Badge>;
  }
  return <Badge variant="secondary">❓ Unknown</Badge>;
}

function getSuggestedActionIcon(action: string) {
  switch (action) {
    case 'call':
      return <Phone className="h-4 w-4 text-blue-500" />;
    case 'text':
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    case 'physical_visit':
      return <MapPin className="h-4 w-4 text-red-500" />;
    default:
      return <Phone className="h-4 w-4" />;
  }
}

interface ContactCadenceBoardProps {
  initialFilter?: CadenceFilter;
  externalFilter?: CadenceFilter;
  onFilterChange?: (filter: CadenceFilter) => void;
  storeId?: string; // Store filter from URL or prop
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (targets: ExecutionTarget[]) => void;
}

export function ContactCadenceBoard({ 
  initialFilter = 'all', 
  externalFilter,
  onFilterChange,
  storeId: propStoreId,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
}: ContactCadenceBoardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get store filter from URL if not passed as prop
  const urlStoreId = searchParams.get('store');
  const storeId = propStoreId || urlStoreId;
  
  const [internalFilter, setInternalFilter] = useState<CadenceFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use external filter if provided, otherwise use internal
  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;
  
  // Use paginated hook - now returns all data with pagination controls
  const { 
    data: contacts, 
    totalCount,
    isLoading, 
    pagination,
    controls,
    verification,
    refetch 
  } = useContactCadenceIntelligence(filter, storeId || undefined);
  
  const recompute = useRecomputeCadenceStatus();

  // Fetch store name if filtering by store
  const { data: storeName } = useQuery({
    queryKey: ['store-name', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data } = await supabase
        .from('store_master')
        .select('store_name')
        .eq('id', storeId)
        .maybeSingle();
      return data?.store_name || null;
    },
    enabled: !!storeId,
  });

  // Client-side search filter (on current page only)
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    if (!searchQuery) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.contact_name?.toLowerCase().includes(query) ||
      c.store_name?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }, [contacts, searchQuery]);

  const clearStoreFilter = () => {
    searchParams.delete('store');
    setSearchParams(searchParams);
  };

  const { data: allSelectionTargets = [] } = useQuery({
    queryKey: ['cadence-selection-targets', filter, storeId, searchQuery],
    queryFn: async () => {
      const batchSize = 1000;
      let from = 0;
      const collected: ExecutionTarget[] = [];

      while (true) {
        let query = supabase
          .from('v_contact_cadence_intelligence')
          .select('contact_id, store_id, phone, cadence_status')
          .order('days_since_last_touch', { ascending: false })
          .range(from, from + batchSize - 1);

        if (filter === 'escalation') {
          query = query.eq('escalation_flag', true);
        } else if (filter !== 'all') {
          query = query.eq('cadence_status', filter);
        }

        if (storeId) {
          query = query.eq('store_id', storeId);
        }

        if (searchQuery.trim()) {
          const term = `%${searchQuery.trim()}%`;
          query = query.or(`contact_name.ilike.${term},store_name.ilike.${term},phone.ilike.${term}`);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []) as Array<{ contact_id: string; store_id: string; phone: string | null; cadence_status: string }>;
        collected.push(
          ...rows.map((row) => ({
            store_id: row.store_id,
            phone: row.phone,
            contact_id: row.contact_id,
            source: 'cadence' as const,
            reason: row.cadence_status,
          }))
        );

        if (!data || data.length < batchSize) break;
        from += batchSize;
      }

      return collected;
    },
    enabled: selectable,
  });

  const toggleRow = useCallback((contact: ContactCadenceItem) => {
    if (!onSelectionChange) return;

    const exists = selectedIds.has(contact.contact_id);
    const nextTargets = exists
      ? allSelectionTargets.filter((target) => target.contact_id !== contact.contact_id)
      : [
          ...allSelectionTargets,
          {
            store_id: contact.store_id,
            phone: contact.phone,
            contact_id: contact.contact_id,
            source: 'cadence' as const,
            reason: contact.cadence_status,
          },
        ];

    onSelectionChange(nextTargets);
  }, [selectedIds, onSelectionChange, allSelectionTargets]);

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;

    const allSelected = allSelectionTargets.length > 0 && allSelectionTargets.every(target => selectedIds.has(target.contact_id || ''));
    onSelectionChange(allSelected ? [] : allSelectionTargets);
  }, [allSelectionTargets, selectedIds, onSelectionChange]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contact Cadence Board</h2>
          <p className="text-sm text-muted-foreground">
            Visibility into contact outreach status • No auto-send
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${recompute.isPending ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Verification Bar - Dynasty OS Compliance */}
      {verification && (
        <Card className={verification.isDiscrepancy ? 'border-destructive bg-destructive/5' : 'border-green-500/30 bg-green-500/5'}>
          <CardContent className="p-2 flex items-center gap-2">
            {verification.isDiscrepancy ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span className="text-sm font-medium">{verification.message}</span>
          </CardContent>
        </Card>
      )}

      {/* Store Filter Banner */}
      {storeId && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm">
                Filtering by: <strong>{storeName || 'Loading...'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/stores/${storeId}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Store
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={clearStoreFilter}>
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search current page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as CadenceFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by cadence" />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value} className={f.color}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No contacts match the current filter
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {selectable && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.contact_id))}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Contact</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-center">📞 Last Call</TableHead>
                  <TableHead className="text-center">💬 Last Text</TableHead>
                  <TableHead className="text-center">Responsive</TableHead>
                  <TableHead className="text-center">Days Since Touch</TableHead>
                  <TableHead>Cadence Status</TableHead>
                  <TableHead className="text-center">Suggested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.contact_id} className={`hover:bg-muted/50 ${selectable && selectedIds.has(contact.contact_id) ? 'bg-primary/5' : ''}`}>
                    {selectable && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(contact.contact_id)}
                          onCheckedChange={() => toggleRow(contact)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{contact.contact_name}</div>
                          <div className="text-xs text-muted-foreground">{contact.phone}</div>
                        </div>
                        {contact.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                        {selectedIds.has(contact.contact_id) && (
                          <Badge variant="default" className="text-xs">Selected for Outreach</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/stores/${contact.store_id}`}
                        className="flex items-center gap-2 hover:text-primary transition-colors group"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        <div>
                          <div className="text-sm group-hover:underline">{contact.store_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">
                            {contact.store_city}, {contact.store_state}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.last_call_attempt_at ? (
                        <div className="text-sm">
                          <div>{format(new Date(contact.last_call_attempt_at), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-muted-foreground">
                            {contact.total_calls_answered}/{contact.total_calls_attempted} answered
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.last_text_sent_at ? (
                        <div className="text-sm">
                          <div>{format(new Date(contact.last_text_sent_at), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-muted-foreground">
                            {contact.total_texts_received}/{contact.total_texts_sent} replied
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getResponsivenessBadge(
                        contact.responsiveness_status, 
                        contact.responsive_by_call, 
                        contact.responsive_by_text
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`font-mono text-lg ${
                        contact.days_since_last_touch > 14 ? 'text-destructive font-bold' :
                        contact.days_since_last_touch > 7 ? 'text-orange-500 font-semibold' :
                        'text-muted-foreground'
                      }`}>
                        {contact.days_since_last_touch >= 999 ? '—' : `${contact.days_since_last_touch}d`}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getCadenceBadge(contact.cadence_status, contact.escalation_flag)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getSuggestedActionIcon(contact.suggested_action)}
                        <span className="text-xs capitalize">{contact.suggested_action.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls - Dynasty OS Compliant */}
          {!isLoading && totalCount > 0 && (
            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalItems={totalCount}
              onPageChange={controls.goToPage}
              onPageSizeChange={controls.setPageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            />
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center">
        ⚠️ This board is for visibility only. No calls or texts are sent automatically.
        Approve actions manually before execution.
      </p>
    </div>
  );
}
