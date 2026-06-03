// Admin review: read all reps' End-of-Day notes across roles.
// Surfaces wrong-address flags as actionable links to the store profile.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClipboardList, MapPinOff, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Row = {
  id: string;
  rep_id: string;
  rep_role: string | null;
  note_date: string;
  completed_count: number;
  wrong_addresses: any[];
  needs: string | null;
  helpful: string | null;
  observations: string | null;
  updated_at: string;
  rep_name?: string;
  rep_email?: string;
};

export default function FieldDayNotesAdmin() {
  const { toast } = useToast();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase
      .from('field_day_notes')
      .select('*')
      .eq('note_date', date)
      .order('updated_at', { ascending: false });
    if (roleFilter !== 'all') q = q.eq('rep_role', roleFilter);
    const { data, error } = await q;
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
      setRows([]);
      setLoading(false);
      return;
    }
    // Enrich with rep name from profiles
    const ids = Array.from(new Set((data ?? []).map((r) => r.rep_id)));
    let profiles: Record<string, { name?: string; email?: string }> = {};
    if (ids.length) {
      const { data: ps } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      profiles = Object.fromEntries(
        (ps ?? []).map((p: any) => [p.id, { name: p.full_name, email: p.email }])
      );
    }
    setRows(
      (data ?? []).map((r: any) => ({
        ...r,
        rep_name: profiles[r.rep_id]?.name,
        rep_email: profiles[r.rep_id]?.email,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [date, roleFilter]);

  async function toggleResolved(row: Row, idx: number) {
    const updated = row.wrong_addresses.map((w: any, i: number) =>
      i === idx ? { ...w, resolved: !w.resolved } : w
    );
    const { error } = await supabase
      .from('field_day_notes')
      .update({ wrong_addresses: updated })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, wrong_addresses: updated } : r)));
  }

  const totals = useMemo(() => {
    const reps = rows.length;
    const completed = rows.reduce((sum, r) => sum + (r.completed_count || 0), 0);
    const flags = rows.reduce((sum, r) => sum + (r.wrong_addresses?.length || 0), 0);
    const unresolved = rows.reduce(
      (sum, r) => sum + (r.wrong_addresses?.filter((w: any) => !w.resolved).length || 0),
      0
    );
    return { reps, completed, flags, unresolved };
  }, [rows]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Field Day Notes
        </h1>
        <p className="text-muted-foreground">
          Daily end-of-day logs from drivers, bikers, and ambassadors.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All</option>
              <option value="driver">Driver</option>
              <option value="biker">Biker</option>
              <option value="ambassador">Ambassador</option>
            </select>
          </div>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Reps reporting" value={totals.reps} />
        <StatCard label="Addresses completed" value={totals.completed} />
        <StatCard label="Wrong-address flags" value={totals.flags} />
        <StatCard label="Unresolved flags" value={totals.unresolved} tone={totals.unresolved > 0 ? 'warn' : 'ok'} />
      </div>

      {/* List */}
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notes filed for {date}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      {r.rep_name || r.rep_email || r.rep_id.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="mr-2">{r.rep_role || 'unknown'}</Badge>
                      {r.completed_count} addresses completed · updated {new Date(r.updated_at).toLocaleTimeString()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {r.wrong_addresses?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                      <MapPinOff className="h-4 w-4 text-amber-500" />
                      Wrong addresses ({r.wrong_addresses.length})
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>On file</TableHead>
                          <TableHead>Correct</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="w-32">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.wrong_addresses.map((w: any, idx: number) => (
                          <TableRow key={idx} className={w.resolved ? 'opacity-60' : ''}>
                            <TableCell className="font-medium">
                              {w.store_id ? (
                                <Link to={`/stores/${w.store_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                                  {w.store_name} <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                w.store_name
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{w.current_address || '—'}</TableCell>
                            <TableCell className="text-sm">{w.suggested_address || '—'}</TableCell>
                            <TableCell className="text-sm">{w.note || '—'}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={w.resolved ? 'outline' : 'default'}
                                onClick={() => toggleResolved(r, idx)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {w.resolved ? 'Reopen' : 'Resolved'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {r.needs && <Block label="Things needed" text={r.needs} />}
                {r.helpful && <Block label="Things that would be helpful" text={r.helpful} />}
                {r.observations && <Block label="Sales observations" text={r.observations} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={
            'text-3xl font-bold mt-1 ' +
            (tone === 'warn' ? 'text-amber-500' : tone === 'ok' ? 'text-emerald-500' : '')
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1">{label}</h4>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{text}</p>
    </div>
  );
}
