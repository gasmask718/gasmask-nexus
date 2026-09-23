/**
 * MyWorkSection — the ambassador's OWN store activity on their dashboard.
 * Handled by me + New stores I added. Server data only (see useAmbassadorMyWork).
 */
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyAddedStores, useMyHandledStores, type MyWorkStore } from '@/hooks/useAmbassadorMyWork';

function fmt(at: string | null) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function WorkList({
  rows,
  isLoading,
  emptyText,
  showApproval,
}: {
  rows: MyWorkStore[];
  isLoading: boolean;
  emptyText: string;
  showApproval?: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ScrollArea className="max-h-72">
      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.store_id}
            onClick={() => navigate(`/ambassador/stores/${row.store_id}`)}
            className="w-full text-left flex items-start justify-between gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{row.name}</p>
              {row.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{row.location}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{fmt(row.at)}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {row.status && (
                <Badge variant="outline" className="text-xs capitalize">
                  {String(row.status).replace('_', ' ')}
                </Badge>
              )}
              {showApproval && row.approval_status && (
                <Badge
                  variant={row.approval_status === 'approved' ? 'default' : 'secondary'}
                  className="text-xs capitalize"
                >
                  {row.approval_status}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

export function MyWorkSection() {
  const handled = useMyHandledStores();
  const added = useMyAddedStores();

  const handledRows = handled.data ?? [];
  const addedRows = added.data ?? [];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Handled by Me
            <Badge variant="secondary" className="ml-1">{handledRows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkList
            rows={handledRows}
            isLoading={handled.isLoading}
            emptyText="No stores marked handled yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4 text-primary" />
            New Stores I Added
            <Badge variant="secondary" className="ml-1">{addedRows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkList
            rows={addedRows}
            isLoading={added.isLoading}
            emptyText="You haven't added any stores yet."
            showApproval
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default MyWorkSection;
