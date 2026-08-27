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
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{l.timestamp}</TableCell>
                    <TableCell>{l.actor}</TableCell>
                    <TableCell className="font-medium">{l.action}</TableCell>
                    <TableCell>{l.target}</TableCell>
                    <TableCell><Badge variant="secondary">{l.result}</Badge></TableCell>
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
