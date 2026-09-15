// ═══════════════════════════════════════════════════════════════════════════════
// PENDING FIELD REVIEW QUEUE — surfaces the existing field_submissions review
// items inside the Activity page. Reuses useFieldSubmissions; no records are
// duplicated and /communication/field-submissions stays the dedicated page.
// ═══════════════════════════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardCheck, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';
import { dynastyStamp } from '@/lib/dates';
import { useFieldSubmissions, getEntityTypeLabel, getActionTypeLabel } from '@/hooks/useFieldSubmissions';

function photoUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const out: string[] = [];
  const walk = (value: any, key = '') => {
    if (value == null) return;
    if (typeof value === 'string') {
      if (/(photo|image|picture|screenshot)/i.test(key) && value.length > 4) out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, key));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, k));
    }
  };
  walk(payload);
  return out;
}

export function PendingFieldReviewQueue() {
  const { data: submissions, isLoading } = useFieldSubmissions({
    status: 'pending_review',
    limit: 25,
  });

  const rows = submissions || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          Staff review queue
          {rows.length > 0 && (
            <Badge variant="secondary" className="text-[11px]">{rows.length} pending</Badge>
          )}
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/communication/field-submissions">
            Full review board <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing is waiting for review.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s: any) => {
                  const photos = photoUrls(s.payload_after);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{s.submitter_name || 'Unknown user'}</div>
                        <div className="text-[11px] capitalize text-muted-foreground">{s.submitted_by_role}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.store_id ? (
                          <Link to={`/stores/${s.store_id}`} className="text-primary hover:underline">
                            {s.store_name || 'Unnamed account'}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getActionTypeLabel(s.action_type)} · {getEntityTypeLabel(s.entity_type)}
                      </TableCell>
                      <TableCell>
                        {photos.length ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <ImageIcon className="h-3.5 w-3.5" /> {photos.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">none</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dynastyStamp(s.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[11px]">
                          Pending review
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/communication/field-submissions?submission=${s.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
