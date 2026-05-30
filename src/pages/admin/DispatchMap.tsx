import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle } from 'lucide-react';

type Status = 'wired' | 'unwired';

interface Row {
  floor: string;
  path?: string;
  shows: string;
  status: Status;
  note?: string;
}

const ROWS: Row[] = [
  // GREEN — dispatch wired
  { floor: 'Ambassador Profile', path: '/ambassadors/:id', shows: 'Stores owned/managed by an ambassador', status: 'wired' },
  { floor: 'Stores (master list)', path: '/stores', shows: 'All approved stores', status: 'wired' },
  { floor: 'Neighborhood Coverage', path: '/territory/neighborhoods', shows: 'Stores grouped by neighborhood', status: 'wired' },
  { floor: 'Sell-Through', path: '/grabba/sell-through', shows: 'Stores ranked by inventory velocity', status: 'wired' },
  { floor: 'All Opportunities', path: '/crm/opportunities', shows: 'Merged high-intent store signals', status: 'wired' },
  { floor: 'Store Detail', path: '/stores/:id', shows: 'Single store dispatch action', status: 'wired' },
  { floor: 'CRM Follow-Ups', path: '/crm/followups', shows: 'Stores with pending follow-up', status: 'wired' },
  { floor: 'Manual Call console', path: '/communication/manual-call', shows: 'Stores queued for outbound', status: 'wired' },
  { floor: 'Pending Route Stops', path: '/routes/pending-stops', shows: 'Stops awaiting assignment', status: 'wired' },
  { floor: 'Territory Map', path: '/territory/map', shows: 'Geospatial store view', status: 'wired' },

  // RED — has stores but not wired
  { floor: 'Store Intelligence', path: '/grabba/store-intelligence', shows: 'AI-scored stores (0-100)', status: 'wired' },
  { floor: 'Grabba StoreMasterProfile', path: '/grabba/stores/:id', shows: 'Master profile of a single store', status: 'wired' },
  { floor: 'OS NeighborhoodIntelligence', path: '/os/neighborhood-intelligence', shows: 'Neighborhood-level signals + stores', status: 'wired' },
  { floor: 'Floor9 Predictions', path: '/grabba/floor9/predictions', shows: 'Stores predicted to need visit', status: 'unwired', note: 'Predicted list is read-only — no dispatch' },
  { floor: 'Grabba ClusterDashboard', path: '/grabba/clusters', shows: 'Stores grouped into clusters', status: 'unwired', note: 'Cluster cards have no dispatch action' },
  { floor: 'Floor1 BrandCRM', path: '/floor1/brand-crm', shows: 'Brand-level CRM store roster', status: 'unwired', note: 'Roster table needs Dispatch column' },
  { floor: 'Ambassador StoresList', path: '/ambassador/stores', shows: 'Ambassador-portal store list', status: 'wired', note: 'Pre-filled assignee = self (ambassador role), RLS-scoped' },
];

const wiredCount = ROWS.filter((r) => r.status === 'wired').length;
const unwiredCount = ROWS.filter((r) => r.status === 'unwired').length;

function StatusBadge({ status }: { status: Status }) {
  if (status === 'wired') {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
        <CheckCircle2 className="h-3 w-3" /> Wired
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1">
      <XCircle className="h-3 w-3" /> Not wired
    </Badge>
  );
}

export default function DispatchMap() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dispatch Map</h1>
        <p className="text-muted-foreground mt-1">
          Reference of every floor/section that lists stores, and whether dispatch (RouteAssignmentDialog) is wired in.
          Use this to track wiring progress across the app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-emerald-600/30">
          <CardHeader className="pb-2">
            <CardDescription>Wired</CardDescription>
            <CardTitle className="text-emerald-500 text-4xl">{wiredCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Has multi-select + Dispatch button using RouteAssignmentDialog.
          </CardContent>
        </Card>
        <Card className="border-red-600/30">
          <CardHeader className="pb-2">
            <CardDescription>Not wired</CardDescription>
            <CardTitle className="text-red-500 text-4xl">{unwiredCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Lists real stores (have a stores.id) but no dispatch action yet.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Floors & sections</CardTitle>
          <CardDescription>
            Note: Territory prospect pages (VisitConsole, GapIntelligence, ScoutConsole, TerritoryCandidates) are
            intentionally excluded — they hold pre-CRM addresses and use "Promote to Store", not dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Floor / Section</TableHead>
                <TableHead>What it shows</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => (
                <TableRow key={r.floor}>
                  <TableCell>
                    <div
                      className={
                        r.status === 'wired'
                          ? 'font-semibold text-emerald-500'
                          : 'font-semibold text-red-500'
                      }
                    >
                      {r.floor}
                    </div>
                    {r.path && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.path}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.shows}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
