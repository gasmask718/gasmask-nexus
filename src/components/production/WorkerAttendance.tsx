import { useTranslation } from "@/hooks/useTranslation";
import { BilingualLabel } from "@/components/portal/BilingualLabel";
/**
 * WORKER ATTENDANCE COMPONENT
 * 
 * Real attendance ledger with check-in/check-out functionality.
 * Replaces the simple "workers present" array with a proper ledger.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  useProductionWorkers, 
  useWorkerAttendance, 
  useCheckInWorker, 
  useCheckOutWorker,
  ProductionWorker 
} from '@/hooks/useProductionPortal';
import { Clock, UserCheck, UserMinus, LogIn, LogOut, Users } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface WorkerAttendanceProps {
  officeId: string;
  date?: Date;
  isDayLocked?: boolean;
}


export function WorkerAttendance({ officeId, date, isDayLocked = false }: WorkerAttendanceProps) {
  const { t } = useTranslation();
  const SHIFT_OPTIONS = [
    { value: "Morning", label: `${t("production.shift.morning")} (6am-2pm)` },
    { value: "Afternoon", label: `${t("production.shift.afternoon")} (2pm-10pm)` },
    { value: "Evening", label: `${t("production.shift.evening")} (10pm-6am)` },
    { value: "Full Day", label: t("production.shift.full_day") },
  ];
  const targetDate = date || new Date();
  const { data: workers = [] } = useProductionWorkers(officeId);
  const { data: attendance = [], isLoading } = useWorkerAttendance(officeId, targetDate);
  const checkIn = useCheckInWorker();
  const checkOut = useCheckOutWorker();
  
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('Morning');

  const activeWorkers = workers.filter(w => w.status === 'active');
  const checkedInWorkerIds = new Set(attendance.map(a => a.worker_id));
  const availableToCheckIn = activeWorkers.filter(w => !checkedInWorkerIds.has(w.id));

  const handleCheckIn = async () => {
    if (!selectedWorker) return;
    
    await checkIn.mutateAsync({
      officeId,
      workerId: selectedWorker,
      shiftLabel: selectedShift,
    });
    
    setShowCheckIn(false);
    setSelectedWorker('');
  };

  const handleCheckOut = async (attendanceId: string) => {
    await checkOut.mutateAsync({ attendanceId, officeId });
  };

  const getWorkerName = (workerId: string) => {
    return workers.find(w => w.id === workerId)?.full_name || 'Unknown Worker';
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("production.attendance")} ({attendance.length} {t("production.status.in_progress")})
          </CardTitle>
          {!isDayLocked && (
            <Button 
              size="sm" 
              onClick={() => setShowCheckIn(true)}
              disabled={availableToCheckIn.length === 0}
            >
              <LogIn className="h-4 w-4 mr-1" />
              Check In
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t("production.no_workers_checked_in")}</p>
              {!isDayLocked && availableToCheckIn.length > 0 && (
                <Button variant="link" onClick={() => setShowCheckIn(true)}>
                  {t("production.check_in_worker")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.map((record) => {
                const isCheckedOut = !!record.checked_out_at;
                
                return (
                  <div 
                    key={record.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      isCheckedOut ? 'bg-muted/30' : 'bg-emerald-50 dark:bg-emerald-950/20'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        isCheckedOut ? 'bg-muted' : 'bg-emerald-100 dark:bg-emerald-900'
                      )}>
                        {isCheckedOut ? (
                          <UserMinus className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{getWorkerName(record.worker_id)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {record.shift_label && (
                            <Badge variant="outline" className="text-xs">
                              {record.shift_label}
                            </Badge>
                          )}
                          <span>
                            In: {record.checked_in_at ? format(new Date(record.checked_in_at), 'h:mm a') : '—'}
                          </span>
                          {isCheckedOut ? (
                            <span>
                              Out: {format(new Date(record.checked_out_at!), 'h:mm a')}
                            </span>
                          ) : (
                            <span className="text-emerald-600">
                              {record.checked_in_at && formatDistanceToNow(new Date(record.checked_in_at), { addSuffix: false })}
                            </span>
                          )}
                          {record.hours_worked && (
                            <span>({record.hours_worked}h)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!isCheckedOut && !isDayLocked && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCheckOut(record.id)}
                        disabled={checkOut.isPending}
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Check Out
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-In Modal */}
      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              <BilingualLabel tKey="production.check_in_worker" en="Check In Worker" />
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium"><BilingualLabel tKey="production.worker" en="Worker" /></label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder={t("production.select_worker")} />
                </SelectTrigger>
                <SelectContent>
                  {availableToCheckIn.map(worker => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name} ({worker.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium"><BilingualLabel tKey="production.shift" en="Shift" /></label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_OPTIONS.map(shift => (
                    <SelectItem key={shift.value} value={shift.value}>
                      {shift.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckIn(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCheckIn}
              disabled={!selectedWorker || checkIn.isPending}
            >
              <LogIn className="h-4 w-4 mr-1" />
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
