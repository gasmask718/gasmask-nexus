import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecruitingPageHeader, OutreachDisabledBanner, EmptyState, MOCK_RUNS } from './shared';

export default function AutomationRuns() {
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
    </div>
  );
}
