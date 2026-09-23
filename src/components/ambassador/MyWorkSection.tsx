/**
 * MyWorkSection — the ambassador's OWN store activity on their dashboard.
 * Handled by me + New stores I added. Server data only (see useAmbassadorMyWork).
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MapPin, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMyAddedStores, useMyHandledStores, type MyWorkStore } from '@/hooks/useAmbassadorMyWork';
import { fromHere } from '@/hooks/useReturnNavigation';

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

export function MyWorkStoreList({
  rows,
  isLoading,
  emptyText,
  showApproval,
  originAnchor,
}: {
  rows: MyWorkStore[];
  isLoading: boolean;
  emptyText: string;
  showApproval?: boolean;
  originAnchor?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="space-y-2">
        {rows.map((row) => (
          <Button
            key={row.store_id}
            variant="ghost"
            onClick={() => navigate(`/ambassador/stores/${row.store_id}`, { state: fromHere(location, originAnchor) })}
            className="w-full h-auto min-h-11 text-left flex items-start justify-between gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30"
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
          </Button>
        ))}
    </div>
  );
}

export function MyWorkSection() {
  const handled = useMyHandledStores();
  const added = useMyAddedStores();

  const handledRows = handled.data ?? [];
  const addedRows = added.data ?? [];
  const previewLimit = 3;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card id="my-work-handled">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Handled by Me
            <Badge variant="secondary" className="ml-1">{handledRows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MyWorkStoreList
            rows={handledRows.slice(0, previewLimit)}
            isLoading={handled.isLoading}
            emptyText="No stores marked handled yet."
            originAnchor="my-work-handled"
          />
          {handledRows.length > previewLimit && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/ambassador/stores?tab=handled')}>
              View All {handledRows.length}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <Card id="my-work-added">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="h-4 w-4 text-primary" />
            New Stores I Added
            <Badge variant="secondary" className="ml-1">{addedRows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MyWorkStoreList
            rows={addedRows.slice(0, previewLimit)}
            isLoading={added.isLoading}
            emptyText="You haven't added any stores yet."
            showApproval
            originAnchor="my-work-added"
          />
          {addedRows.length > previewLimit && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/ambassador/stores?tab=added')}>
              View All {addedRows.length}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MyWorkSection;
