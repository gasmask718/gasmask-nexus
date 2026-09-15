// ═══════════════════════════════════════════════════════════════════════════════
// FIELD WORKFORCE ROSTER — who is working, where, on what, how far along.
// Reads existing identities via useFieldWorkforce. Read-only.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, MapPin, CircleSlash } from 'lucide-react';
import type { WorkerRow, WorkforceRole } from '@/hooks/useFieldWorkforce';

const ROLE_LABEL: Record<WorkforceRole, string> = {
  ambassador: 'Ambassador',
  driver: 'Driver',
  biker: 'Biker',
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function WorkforceRosterPanel({
  workers,
  isLoading,
}: {
  workers: WorkerRow[];
  isLoading: boolean;
}) {
  const [role, setRole] = useState<'all' | WorkforceRole>('all');
  const [territory, setTerritory] = useState('all');
  const [activeState, setActiveState] = useState<'all' | 'active' | 'inactive'>('active');
  const [assignState, setAssignState] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [routeStatus, setRouteStatus] = useState('all');
  const [search, setSearch] = useState('');

  const territories = useMemo(() => {
    const set = new Set<string>();
    workers.forEach((w) => w.territory?.split(',').forEach((t) => {
      const v = t.trim();
      if (v) set.add(v);
    }));
    return Array.from(set).sort();
  }, [workers]);

  const routeStatuses = useMemo(() => {
    const set = new Set<string>();
    workers.forEach((w) => { if (w.currentRoute?.status) set.add(w.currentRoute.status); });
    return Array.from(set).sort();
  }, [workers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers
      .filter((w) => {
        if (role !== 'all' && w.role !== role) return false;
        if (activeState === 'active' && !w.active) return false;
        if (activeState === 'inactive' && w.active) return false;
        if (territory !== 'all' && !(w.territory || '').toLowerCase().includes(territory.toLowerCase())) return false;
        if (assignState === 'assigned' && !w.currentRoute) return false;
        if (assignState === 'unassigned' && w.currentRoute) return false;
        if (routeStatus !== 'all' && w.currentRoute?.status !== routeStatus) return false;
        if (q && !w.name.toLowerCase().includes(q) && !(w.territory || '').toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.remainingStopCount - a.remainingStopCount || a.name.localeCompare(b.name));
  }, [workers, role, activeState, territory, assignState, routeStatus, search]);

  const onRoute = filtered.filter((w) => w.currentRoute).length;
  const noRoute = filtered.filter((w) => !w.currentRoute && w.active).length;
  const remaining = filtered.reduce((s, w) => s + w.remainingStopCount, 0);
  const maxLoad = Math.max(0, ...filtered.map((w) => w.remainingStopCount));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> People shown</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> On a route</p>
          <p className="text-2xl font-bold text-primary">{onRoute}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CircleSlash className="h-3 w-3" /> Active, no route</p>
          <p className="text-2xl font-bold">{noRoute}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Stops remaining</p>
          <p className="text-2xl font-bold">{remaining}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Input placeholder="Search name or territory…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="ambassador">Ambassadors</SelectItem>
              <SelectItem value="driver">Drivers</SelectItem>
              <SelectItem value="biker">Bikers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={territory} onValueChange={setTerritory}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Territory" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All territories</SelectItem>
              {territories.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeState} onValueChange={(v) => setActiveState(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
              <SelectItem value="all">Active + inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignState} onValueChange={(v) => setAssignState(v as any)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Assigned + unassigned</SelectItem>
              <SelectItem value="assigned">On a route</SelectItem>
              <SelectItem value="unassigned">No route</SelectItem>
            </SelectContent>
          </Select>
          <Select value={routeStatus} onValueChange={setRouteStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Route status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any route status</SelectItem>
              {routeStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No people match these filters.</div>
          ) : (
            <ScrollArea className="h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Territory / coverage</TableHead>
                    <TableHead>Current route</TableHead>
                    <TableHead className="text-right">Stops</TableHead>
                    <TableHead className="text-right">Done</TableHead>
                    <TableHead className="text-right">Left</TableHead>
                    <TableHead>Last check-in</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead>Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w) => (
                    <TableRow key={`${w.role}:${w.id}`}>
                      <TableCell className="font-medium">
                        {w.name}
                        {w.remainingStopCount > 0 && w.remainingStopCount === maxLoad && (
                          <Badge variant="outline" className="ml-2 text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                            heaviest load
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{ROLE_LABEL[w.role]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={w.active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground'}>
                          {w.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate" title={w.territory || ''}>
                        {w.territory || '—'}
                        {w.assignedStores !== null && (
                          <span className="text-xs text-muted-foreground"> · {w.assignedStores} stores</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {w.currentRoute ? (
                          <Link to={`/routes/${w.currentRoute.id}`} className="hover:underline">
                            {w.currentRoute.name || w.currentRoute.date || 'Route'}
                            <Badge variant="secondary" className="ml-2 text-[10px]">{w.currentRoute.status || 'n/a'}</Badge>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">No route</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{w.assignedStopCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.completedStopCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{w.remainingStopCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(w.lastCheckInAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(w.lastActivityAt)}</TableCell>
                      <TableCell className="text-xs">
                        {w.loginState === 'active_login'
                          ? <span className="text-emerald-400">Has login</span>
                          : <span className="text-muted-foreground">No login yet</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
