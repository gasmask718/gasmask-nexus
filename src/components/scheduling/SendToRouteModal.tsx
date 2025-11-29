// ═══════════════════════════════════════════════════════════════════════════════
// SEND TO ROUTE MODAL — Create Routes or Schedule Tasks from Selection
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouteBuilder } from '@/hooks/useRouteBuilder';
import { useScheduler } from '@/hooks/useScheduler';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, Clock, User, Route } from 'lucide-react';
import { format } from 'date-fns';

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
  const [scheduledDate, setScheduledDate] = useState(
    format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState('10:00');
  const [routeName, setRouteName] = useState('');
  const [taskOnly, setTaskOnly] = useState(false);

  const loading = routeLoading || taskLoading;

  useEffect(() => {
    if (!open) return;
    
    // Fetch drivers - cast to any to avoid TS depth issues
    const client = supabase as any;
    client
      .from('profiles')
      .select('id, name, role')
      .eq('status', 'active')
      .then((result: any) => {
        if (result.data) {
          const driverList = result.data
            .filter((p: any) => ['driver', 'biker'].includes(p.role))
            .map((d: any) => ({ id: d.id, name: d.name || 'Unknown' }));
          setDrivers(driverList);
        }
      });
    
    const dateStr = format(new Date(scheduledDate), 'MMM d');
    setRouteName(`${brand || 'Route'} - ${dateStr}`);
  }, [open, brand, scheduledDate]);

  const handleSubmit = async () => {
    const date = new Date(scheduledDate);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);

    const driverId = selectedDriver && selectedDriver !== 'unassigned' ? selectedDriver : undefined;

    if (taskOnly) {
      await createTask({
        type: 'visit_stores',
        payload: { store_ids: storeIds, driver_id: driverId, brand, region },
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
        payload: { store_ids: storeIds, driver_id: driverId, brand, region, route_name: routeName },
        runAt: date,
      });
    }

    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Send to Route
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Creating route for <span className="font-medium text-foreground">{storeIds.length} stores</span>
            {brand && <span> ({brand})</span>}
          </div>

          {!taskOnly && (
            <div className="space-y-2">
              <Label htmlFor="routeName">Route Name</Label>
              <Input
                id="routeName"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Brooklyn Run - Dec 1"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>
              <User className="h-4 w-4 inline mr-1" />
              Assign Driver
            </Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {drivers.map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              <Calendar className="h-4 w-4 inline mr-1" />
              Scheduled Date
            </Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>
              <Clock className="h-4 w-4 inline mr-1" />
              Start Time
            </Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="taskOnly"
              checked={taskOnly}
              onCheckedChange={(checked) => setTaskOnly(checked as boolean)}
            />
            <Label htmlFor="taskOnly" className="text-sm cursor-pointer">
              Create scheduled task only (no route)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {taskOnly ? 'Schedule Task' : 'Create Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SendToRouteModal;
