/**
 * StoreTaskRouteButtons — profile actions that auto-schedule a ROUTE STOP
 * tagged with the reason, using the canonical `routes` / `route_stops`
 * infrastructure (same as "Add to Route Plan").
 */
import { ClipboardCheck, PhoneCall, Loader2, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { dynastyDateAbsolute } from '@/lib/dates';
import {
  TASK_REASONS,
  type TaskReason,
  useStoreTaskRouteStops,
  useAddStoreTaskStop,
  useRemoveStoreTaskStop,
} from '@/hooks/useStoreTaskRoute';

interface Props {
  storeId: string;
  storeName?: string;
}

const ICONS: Record<TaskReason, typeof ClipboardCheck> = {
  physical_inventory_check: ClipboardCheck,
  update_contact_details: PhoneCall,
};

export function StoreTaskRouteButtons({ storeId, storeName }: Props) {
  const navigate = useNavigate();
  const { data: stops = [], isLoading } = useStoreTaskRouteStops(storeId);
  const add = useAddStoreTaskStop(storeId, storeName);
  const remove = useRemoveStoreTaskStop(storeId);

  const scheduledFor = (reason: TaskReason) => stops.find((s) => s.stop_reason === reason);

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="pt-6 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Field Tasks — auto-adds a route stop
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(TASK_REASONS) as TaskReason[]).map((reason) => {
            const Icon = ICONS[reason];
            const stop = scheduledFor(reason);
            return (
              <div key={reason} className="space-y-2">
                <Button
                  variant={stop ? 'secondary' : 'default'}
                  className="w-full justify-start h-auto py-3 text-left"
                  disabled={isLoading || add.isPending || !!stop}
                  onClick={() => add.mutate(reason)}
                >
                  {add.isPending && add.variables === reason ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  <span className="whitespace-normal">
                    {reason === 'physical_inventory_check'
                      ? 'Physical Inventory Check Needed'
                      : 'Update Telephone / Contact Details Needed'}
                  </span>
                </Button>

                {stop && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5">
                    <Badge variant="outline" className="text-[10px]">Scheduled</Badge>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate"
                      onClick={() => navigate(`/routes/${stop.route_id}`)}
                      title="Open route"
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      {TASK_REASONS[reason]} ·{' '}
                      {stop.route?.date ? dynastyDateAbsolute(stop.route.date) : 'route'}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 w-6 p-0 text-destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(stop.id)}
                      title="Cancel this stop"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Completing the visit on the route clears the flag automatically.
        </p>
      </CardContent>
    </Card>
  );
}

export default StoreTaskRouteButtons;
