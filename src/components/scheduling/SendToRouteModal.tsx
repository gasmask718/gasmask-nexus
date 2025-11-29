// ═══════════════════════════════════════════════════════════════════════════════
// SEND TO ROUTE MODAL — Create Routes or Schedule Tasks from Selection
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useRouteBuilder } from '@/hooks/useRouteBuilder';
import { useScheduler } from '@/hooks/useScheduler';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

interface SendToRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeIds: string[];
  brand?: string;
  region?: string;
  onSuccess?: () => void;
}

interface Driver {
  id: string;
  name: string;
}

export function SendToRouteModal({
  open,
  onOpenChange,
  storeIds,
  brand,
  region,
  onSuccess,
}: SendToRouteModalProps) {
  const { buildRouteFromStores, saveRoute, loading: routeLoading } = useRouteBuilder();
  const { createTask, loading: taskLoading } = useScheduler();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(
    format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState<string>('10:00');
  const [routeName, setRouteName] = useState<string>('');
  const [taskOnly, setTaskOnly] = useState<boolean>(false);

  const loading = routeLoading || taskLoading;

  useEffect(() => {
    if (!open) return;

    const fetchDrivers = async () => {
      try {
        const client = supabase as any;
        const result = await client
          .from('profiles')
          .select('id, name, role')
          .eq('status', 'active');

        if (result.data) {
          const driverList: Driver[] = result.data
            .filter((p: any) => ['driver', 'biker'].includes(p.role))
            .map((d: any) => ({
              id: d.id,
              name: d.name || 'Unknown',
            }));
          setDrivers(driverList);
        }
      } catch (err) {
        console.error('Failed to fetch drivers', err);
      }
    };

    fetchDrivers();

    const dateStr = format(new Date(scheduledDate), 'MMM d');
    setRouteName(`${brand || 'Route'} - ${dateStr}`);
  }, [open, brand, scheduledDate]);

  const handleSubmit = async () => {
    if (!storeIds.length) return;

    const date = new Date(scheduledDate);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);

    const driverId =
      selectedDriver && selectedDriver !== 'unassigned' ? selectedDriver : undefined;

    if (taskOnly) {
      await createTask({
        type: 'visit_stores',
        payload: {
          store_ids: storeIds,
          driver_id: driverId,
          brand,
          region,
        },
        runAt: date,
      });
    } else {
      const routePayload = await buildRouteFromStores({
        name: routeName,
        storeIds,
        driverId,
        brand,
        region,
        scheduledDate: date,
        startTime,
      });

      await saveRoute(routePayload);

      await createTask({
        type: 'delivery_run',
        payload: {
          store_ids: storeIds,
          driver_id: driverId,
          brand,
          region,
          route_name: routeName,
        },
        runAt: date,
      });
    }

    onSuccess?.();
    onOpenChange(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedDriver('');
      setTaskOnly(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to Route</DialogTitle>
          <DialogDescription>
            Creating route / scheduled task for {storeIds.length} store
            {storeIds.length === 1 ? '' : 's'}
            {brand ? ` (${brand})` : ''}
          </DialogDescription>
        </DialogHeader>

        {!taskOnly && (
          <div className="space-y-1">
            <Label htmlFor="route-name">Route Name</Label>
            <Input
              id="route-name"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Brooklyn Run - Dec 1"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label>Assign Driver</Label>
          <Select
            value={selectedDriver || 'unassigned'}
            onValueChange={(value) =>
              setSelectedDriver(value === 'unassigned' ? '' : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="route-date">Scheduled Date</Label>
            <Input
              id="route-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="route-time">Start Time</Label>
            <Input
              id="route-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="task-only"
            checked={taskOnly}
            onCheckedChange={(checked) => setTaskOnly(Boolean(checked))}
          />
          <Label htmlFor="task-only" className="cursor-pointer">
            Create scheduled task only (no route)
          </Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !storeIds.length}
          >
            {loading
              ? 'Working...'
              : taskOnly
              ? 'Schedule Task'
              : 'Create Route'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SendToRouteModal;
