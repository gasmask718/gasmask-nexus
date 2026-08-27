import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bot, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
  RecruitingPageHeader,
  OutreachDisabledBanner,
  EmptyState,
  LaneBadge,
  MOCK_RUNS,
  MOCK_SCRAPERS,
} from './shared';
import OverpassStaffDiscovery from './OverpassStaffDiscovery';

export default function AutomationRuns() {
  const [overpassOpen, setOverpassOpen] = useState(false);
  const rows = MOCK_RUNS;
  const summary = [
    { label: 'Last Run', value: 'Aug 27, 2026 · 12:04 PM' },
    { label: 'Successful Runs', value: '128' },
    { label: 'Failed Runs', value: '3' },
    { label: 'Candidates Added', value: '1,904' },
    { label: 'Duplicates', value: '1,412' },
  ];

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Automation Runs"
        subtitle="Visual representation of future automation activity. The engine is not connected yet."
        badge="Placeholder Data"
      />
      <OutreachDisabledBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4">
          {rows.length === 0 ? (
            <EmptyState
              title="No Automation Runs Yet"
              description="Automation activity will appear here once the recruiting engine is connected."
            />
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Run History</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Lane</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Searches</TableHead>
                      <TableHead className="text-right">Results</TableHead>
                      <TableHead className="text-right">New Candidates</TableHead>
                      <TableHead className="text-right">Duplicates</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.id}</TableCell>
                        <TableCell className="text-muted-foreground">{r.date}</TableCell>
                        <TableCell>{r.lane}</TableCell>
                        <TableCell>{r.source}</TableCell>
                        <TableCell className="text-right">{r.searches}</TableCell>
                        <TableCell className="text-right">{r.results}</TableCell>
                        <TableCell className="text-right">{r.newCandidates}</TableCell>
                        <TableCell className="text-right">{r.duplicates}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'Completed' ? 'secondary' : 'outline'}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scrapers" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Registered Scrapers</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scraper</TableHead>
                    <TableHead>Lane</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Targets</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_SCRAPERS.map((s) => (
                    <TableRow
                      key={s.id}
                      className={s.id === 'scraper-overpass-staff' ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => s.id === 'scraper-overpass-staff' && setOverpassOpen(true)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          {s.name}
                        </div>
                      </TableCell>
                      <TableCell><LaneBadge lane={s.lane} /></TableCell>
                      <TableCell>{s.provider}</TableCell>
                      <TableCell className="max-w-[220px] text-muted-foreground">{s.target}</TableCell>
                      <TableCell>{s.schedule}</TableCell>
                      <TableCell className="text-muted-foreground">{s.lastRun}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={s.id === 'scraper-overpass-staff'
                            ? 'border-primary/40 text-primary'
                            : 'border-destructive/40 text-destructive'}
                        >
                          {s.id === 'scraper-overpass-staff' ? 'Live (Discovery Only)' : s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (s.id === 'scraper-overpass-staff') {
                              setOverpassOpen(true);
                            } else {
                              toast.info('Scraper is not connected yet — this is a UI placeholder.');
                            }
                          }}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Run Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_SCRAPERS.map((s) => (
              <Card key={`${s.id}-notes`}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{s.name}</p>
                    <LaneBadge lane={s.lane} />
                  </div>
                  <p className="text-sm text-muted-foreground">{s.notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
