// ═══════════════════════════════════════════════════════════════════════════════
// LIVE ROUTES — management overview of routes in flight.
// Same canonical routes/route_stops data the delivery pages use. Read-only.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink } from 'lucide-react';
import type { LiveRouteRow } from '@/hooks/useFieldWorkforce';

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

const FINISHED = ['completed', 'cancelled', 'canceled'];

export function LiveRoutesPanel({ routes, isLoading }: { routes: LiveRouteRow[]; isLoading: boolean }) {
  const [status, setStatus] = useState('open');
  const [role, setRole] = useState('all');
  const [territory, setTerritory] = useState('all');

  const statuses = useMemo(
    () => Array.from(new Set(routes.map((r) => r.status).filter(Boolean) as string[])).sort(),
    [routes],
  );
  const territories = useMemo(
    () => Array.from(new Set(routes.map((r) => r.territory).filter(Boolean) as string[])).sort(),
    [routes],
  );

  const filtered = useMemo(
    () =>
      routes
        .filter((r) => {
          const s = String(r.status || '').toLowerCase();
          if (status === 'open' && FINISHED.includes(s)) return false;
          if (status !== 'open' && status !== 'all' && r.status !== status) return false;
          if (role !== 'all' && r.workerRole !== role) return false;
          if (territory !== 'all' && r.territory !== territory) return false;
          return true;
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [routes, status, role, territory],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open routes</SelectItem>
              <SelectItem value="all">All routes</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Worker role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="ambassador">Ambassador</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="biker">Biker</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={territory} onValueChange={setTerritory}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Territory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All territories</SelectItem>
              {territories.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button asChild variant="outline" size="sm">
            <Link to="/delivery/all-routes">All routes page <ExternalLink className="h-3 w-3 ml-1" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/delivery/live-map">Live map <ExternalLink className="h-3 w-3 ml-1" /></Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No routes match these filters.</div>
          ) : (
            <ScrollArea className="h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[160px]">Progress</TableHead>
                    <TableHead className="text-right">Left</TableHead>
                    <TableHead>Last check-in</TableHead>
                    <TableHead>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const pct = r.totalStops ? Math.round((r.completedStops / r.totalStops) * 100) : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link to={`/routes/${r.id}`} className="font-medium hover:underline">
                            {r.name || r.date || r.id.slice(0, 8)}
                          </Link>
                          {r.date && <div className="text-xs text-muted-foreground">{r.date}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{r.workerName || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="text-sm capitalize">{r.workerRole}</TableCell>
                        <TableCell className="text-sm">{r.territory || '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{r.status || 'n/a'}</Badge></TableCell>
                        <TableCell>
                          <Progress value={pct} className="h-2" />
                          <span className="text-xs text-muted-foreground">{r.completedStops}/{r.totalStops} stops</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.remainingStops}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(r.lastCheckInAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(r.lastActivityAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
