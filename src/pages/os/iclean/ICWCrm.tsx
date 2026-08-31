import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ICW_CATEGORIES } from '@/lib/icw/categories';
import type { ICWSourcedLead } from '@/lib/icw/leadIngestion';

const STATUSES = ['prospect', 'qualified', 'promoted', 'rejected'] as const;

const statusClass = (s: string) =>
  s === 'promoted'
    ? 'bg-[#3C9F40]/10 text-[#3C9F40] border-[#3C9F40]/20'
    : s === 'qualified'
      ? 'bg-[#B4D334]/10 text-[#B4D334] border-[#B4D334]/20'
      : s === 'rejected'
        ? 'bg-destructive/10 text-destructive border-destructive/20'
        : 'bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20';

export default function ICWCrm() {
  const [status, setStatus] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['icw-sourced-leads', 'crm'],
    queryFn: async (): Promise<ICWSourcedLead[]> => {
      const { data, error } = await supabase
        .from('icw_sourced_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ICWSourcedLead[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (leads ?? []).filter((l) => {
      if (status !== 'all' && l.status !== status) return false;
      if (category !== 'all' && !(l.category_groups ?? []).includes(category)) return false;
      if (
        q &&
        ![l.full_name, l.phone, l.email, l.city, l.state, l.source_platform]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [leads, status, category, search]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
          ICW CRM
        </h1>
        <p className="text-muted-foreground mt-1">
          Canonical sourced leads · same records as the IClean Hub Map · no outreach wired
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#4FC3E8]" />
            Sourced Leads
            <Badge variant="outline" className="ml-2">
              {filtered.length}
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name, phone, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {ICW_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No leads match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Name', 'Contact', 'Location', 'Categories', 'Source', 'License', 'Status'].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left p-3 text-sm font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {l.full_name || '—'}
                        <div className="text-[10px] text-muted-foreground font-mono">{l.id.slice(0, 8)}</div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        <div>{l.phone || '—'}</div>
                        <div>{l.email || ''}</div>
                      </td>
                      <td className="p-3 text-sm">
                        {[l.city, l.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(l.category_groups ?? []).length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            (l.category_groups ?? []).map((c) => (
                              <Badge
                                key={c}
                                variant="outline"
                                className="bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20"
                              >
                                {c}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{l.source_platform || '—'}</td>
                      <td className="p-3 text-sm">
                        {l.license_number ? (
                          <span>
                            {l.license_number}
                            <div className="text-[10px] text-muted-foreground">
                              {l.license_status || l.license_type || ''}
                            </div>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusClass(l.status)}>
                          {l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
