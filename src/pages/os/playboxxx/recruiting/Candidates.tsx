import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  RecruitingPageHeader, OutreachDisabledBanner, EmptyState, LaneBadge, laneForCategory,
  prettyRole, STAFF_CATEGORIES, CREATOR_CATEGORIES,
} from './shared';
import CandidateDetailDialog, { CandidateRow } from './CandidateDetailDialog';

const PAGE_SIZE = 25;

export default function Candidates() {
  const [tab, setTab] = useState<'all' | 'staff' | 'creator'>('all');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState<'created_at' | 'business_name'>('created_at');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CandidateRow | null>(null);

  const laneCategories =
    tab === 'staff' ? [...STAFF_CATEGORIES]
      : tab === 'creator' ? [...CREATOR_CATEGORIES]
        : [...STAFF_CATEGORIES, ...CREATOR_CATEGORIES];

  const { data, isLoading, error } = useQuery({
    queryKey: ['recruiting-candidates', tab, search, role, source, sort, page],
    queryFn: async () => {
      let q = supabase
        .from('business_leads')
        .select(
          'id,business_name,contact_name,category,city,state,phone,email,website,full_address,source,external_source,status,created_at,updated_at',
          { count: 'exact' },
        )
        .in('category', role === 'all' ? laneCategories : [role])
        .order(sort, { ascending: sort === 'business_name' })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) q = q.ilike('business_name', `%${search.trim()}%`);
      if (source !== 'all') q = q.eq('source', source);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as CandidateRow[], count: count ?? 0 };
    },
  });

  const roleOptions = tab === 'creator' ? CREATOR_CATEGORIES : tab === 'staff' ? STAFF_CATEGORIES
    : [...STAFF_CATEGORIES, ...CREATOR_CATEGORIES];

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Candidates"
        subtitle="View and organize candidates discovered through the Recruiting Engine."
        badge="Search + Ingestion Only"
      />
      <OutreachDisabledBanner />

      <Tabs
        value={tab}
        onValueChange={(v) => { setTab(v as typeof tab); setRole('all'); setPage(0); }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="creator">Creator / Model</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((c) => (
                <SelectItem key={c} value={c}>{prettyRole(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="osm">OpenStreetMap</SelectItem>
              <SelectItem value="google_places">Google Places</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest discovered</SelectItem>
              <SelectItem value="business_name">Name (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{String((error as Error).message)}</CardContent></Card>
      )}

      {isLoading ? (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent></Card>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          title="No Candidates Found"
          description="Candidates discovered through the Recruiting Engine will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Discovered</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <TableCell className="font-medium">{r.business_name || r.contact_name || '—'}</TableCell>
                    <TableCell><LaneBadge lane={laneForCategory(r.category)} /></TableCell>
                    <TableCell>{prettyRole(r.category)}</TableCell>
                    <TableCell>{[r.city, r.state].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.external_source || r.source || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{r.status || 'new'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {(data?.count ?? 0).toLocaleString()} candidates · page {page + 1} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <CandidateDetailDialog candidate={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
