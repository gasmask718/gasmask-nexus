import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Info, Sparkles } from 'lucide-react';
import {
  RecruitingPageHeader, OutreachDisabledBanner, CREATOR_SOURCE, CREATOR_CATEGORY_LABELS,
  MOCK_CREATORS, EmptyState,
} from './shared';

export default function CreatorSourcing() {
  const rows = MOCK_CREATORS;

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Creator / Model Sourcing"
        subtitle="Discover creators and models through approved social discovery sources."
        badge="Discovery Only — Not Approved for Outreach"
      />
      <OutreachDisabledBanner />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Creator and model discovery is separate from Local Staff sourcing.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Source: {CREATOR_SOURCE}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CREATOR_CATEGORY_LABELS.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No Candidates Found"
          description="Candidates discovered through the Recruiting Engine will appear here."
        />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Discovered Profiles</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                  <TableHead>Portfolio</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Discovered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.handle}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.handle}</TableCell>
                    <TableCell>{r.platform}</TableCell>
                    <TableCell>{r.location}</TableCell>
                    <TableCell className="text-right">{r.followers}</TableCell>
                    <TableCell>{r.portfolio}</TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell className="text-muted-foreground">{r.discovered}</TableCell>
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
