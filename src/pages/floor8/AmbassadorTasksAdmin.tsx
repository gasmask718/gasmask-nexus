/**
 * AmbassadorTasksAdmin — Admin view of every ambassador's task list.
 *
 * READS: v_ambassador_tasks_admin (joins store_name/address/neighborhood/
 * borough, computes state: done / OVERDUE / due today / no date / upcoming,
 * plus days_overdue). Grouped by ambassador; ambassadors with overdue tasks
 * float to the top, and within each group overdue tasks lead.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClipboardList, Phone, Search } from 'lucide-react';
import { format } from 'date-fns';

interface AdminTaskRow {
  id: string | null;
  ambassador_name: string | null;
  task: string | null;
  task_type: string | null;
  state: string | null;
  days_overdue: number | null;
  due_date: string | null;
  done_at: string | null;
  priority: number | null;
  person_to_talk_to: string | null;
  phone: string | null;
  outcome: string | null;
  store_name: string | null;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  created_at: string | null;
}

const STATE_BADGE: Record<string, string> = {
  OVERDUE: 'bg-destructive/15 text-destructive border-destructive/40',
  'due today': 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  upcoming: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  'no date': 'bg-muted text-muted-foreground border-border',
  done: 'bg-green-500/15 text-green-600 border-green-500/30',
};

const stateRank = (s: string | null) =>
  ({ OVERDUE: 0, 'due today': 1, upcoming: 2, 'no date': 3, done: 4 }[s || ''] ?? 5);

export default function AmbassadorTasksAdmin() {
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ambassador-tasks-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ambassador_tasks_admin')
        .select('*');
      if (error) throw error;
      return (data || []) as AdminTaskRow[];
    },
  });

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.ambassador_name, r.task, r.store_name, r.person_to_talk_to, r.neighborhood, r.borough]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)),
        )
      : rows;

    const byAmb = new Map<string, AdminTaskRow[]>();
    for (const r of filtered) {
      const key = r.ambassador_name || 'Unknown';
      if (!byAmb.has(key)) byAmb.set(key, []);
      byAmb.get(key)!.push(r);
    }

    return [...byAmb.entries()]
      .map(([name, tasks]) => {
        tasks.sort((a, b) => {
          const rankDiff = stateRank(a.state) - stateRank(b.state);
          if (rankDiff !== 0) return rankDiff;
          if (a.state === 'OVERDUE') return (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
          return (a.due_date || '9999').localeCompare(b.due_date || '9999');
        });
        return {
          name,
          tasks,
          overdueCount: tasks.filter((t) => t.state === 'OVERDUE').length,
          openCount: tasks.filter((t) => t.state !== 'done').length,
        };
      })
      .sort((a, b) => b.overdueCount - a.overdueCount || b.openCount - a.openCount || a.name.localeCompare(b.name));
  }, [rows, search]);

  const totalOverdue = rows.filter((r) => r.state === 'OVERDUE').length;
  const totalOpen = rows.filter((r) => r.state !== 'done').length;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Ambassador Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalOpen} open across all ambassadors
            {totalOverdue > 0 && (
              <span className="text-destructive font-semibold"> · {totalOverdue} overdue</span>
            )}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, stores, people…"
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm italic text-muted-foreground">
            No tasks found.
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.name} className={g.overdueCount > 0 ? 'border-destructive/40' : ''}>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
              <CardTitle className="text-lg">{g.name}</CardTitle>
              <div className="flex items-center gap-2">
                {g.overdueCount > 0 && (
                  <Badge variant="outline" className={STATE_BADGE.OVERDUE}>
                    {g.overdueCount} OVERDUE
                  </Badge>
                )}
                <Badge variant="secondary">{g.openCount} open</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.tasks.map((t) => (
                    <TableRow key={t.id} className={t.state === 'OVERDUE' ? 'bg-destructive/5' : ''}>
                      <TableCell className="max-w-[320px]">
                        <p className={`text-sm ${t.state === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {t.task}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(t.task_type || 'general').replace('_', ' ')}
                          {t.priority ? ` · P${t.priority}` : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATE_BADGE[t.state || ''] || STATE_BADGE['no date']}>
                          {t.state === 'OVERDUE' && t.days_overdue
                            ? `OVERDUE ${t.days_overdue}d`
                            : t.state || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {t.due_date ? format(new Date(t.due_date + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.store_name ? (
                          <>
                            <p>{t.store_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {[t.neighborhood, t.borough].filter(Boolean).join(', ')}
                            </p>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.person_to_talk_to || '—'}
                        {t.phone && (
                          <a href={`tel:${t.phone}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                            <Phone className="h-3 w-3" />{t.phone}
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                        {t.outcome || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
