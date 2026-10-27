import { MapPin, Phone, Compass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { useAmbassadorAreaProspects } from '@/hooks/useAmbassadorAreaProspects';

export function AreaProspectsList({ search, neighborhood, page, onNeighborhoodChange, onPageChange }: {
  search: string; neighborhood: string; page: number;
  onNeighborhoodChange: (value: string) => void; onPageChange: (value: number) => void;
}) {
  const { data, isLoading, error, refetch } = useAmbassadorAreaProspects(search, neighborhood, page);
  return (
    <section className="min-w-0 space-y-3" aria-labelledby="area-prospects-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="area-prospects-heading" className="font-semibold">Prospects in my area{data ? ` (${data.total.toLocaleString()})` : ''}</h2>
        <Select value={neighborhood || '__all__'} onValueChange={(v) => onNeighborhoodChange(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filter prospects by neighborhood"><SelectValue placeholder="All neighborhoods" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All neighborhoods</SelectItem>
            {(data?.neighborhoods || []).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error.message}</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
        : isLoading ? <Skeleton className="h-24" />
        : !data?.items.length ? <p className="py-6 text-sm text-muted-foreground">No prospects in your area match these filters.</p>
        : <>
          <div className="grid gap-3">
            {data.items.map((p) => <Card key={p.prospect_key} className="border-dashed">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <Compass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <h3 className="min-w-0 flex-1 break-words font-semibold">{p.store_name || 'Unnamed location'}</h3>
                  {p.recheck_note?.startsWith('Go') && <Badge variant="secondary" className="shrink-0">Licensed</Badge>}
                </div>
                <p className="break-words text-sm text-muted-foreground">{p.address}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{[p.neighborhood, p.state].filter(Boolean).join(', ')}</span>
                  {p.phone && <Button asChild variant="link" size="sm" className="h-auto px-0"><a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`} aria-label={`Call ${p.store_name || 'prospect'} at ${p.phone}`}><Phone className="mr-1 h-3 w-3" />{p.phone}</a></Button>}
                </div>
              </CardContent>
            </Card>)}
          </div>
          <div className="[&>div]:flex-wrap [&>div]:gap-3 [&>div]:px-0">
            <DataTablePagination currentPage={page} totalPages={Math.max(1, Math.ceil(data.total / 25))} pageSize={25} totalItems={data.total} onPageChange={onPageChange} />
          </div>
        </>}
    </section>
  );
}