import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RecruitingPageHeader, OutreachDisabledBanner, EmptyState, MOCK_LOGS } from './shared';

export default function AuditLogs() {
  const rows = MOCK_LOGS;

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Audit / Logs"
        subtitle="Transparency into every recruiting action taken inside this hub."
        badge="Placeholder Data"
      />
      <OutreachDisabledBanner />

      {rows.length === 0 ? (
        <EmptyState title="No Activity Logged" description="Recruiting actions will be recorded here." />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Activity Log</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Lane</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{l.when}</TableCell>
                    <TableCell>{l.lane}</TableCell>
                    <TableCell className="font-medium">{l.event}</TableCell>
                    <TableCell>{l.detail}</TableCell>
                    <TableCell>{l.source}</TableCell>
                    <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
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
