/**
 * DAY CLOSE PANEL COMPONENT
 * 
 * Controls for closing/locking the production day.
 * Shows day status and allows admin unlock.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useDailyCloseout, useCloseDay, useUnlockDay, useDailyKPIs, useVarianceSummary } from '@/hooks/useProductionPortal';
import { Lock, Unlock, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DayClosePanelProps {
  officeId: string;
  date?: Date;
  isAdmin?: boolean;
}

export function DayClosePanel({ officeId, date, isAdmin = false }: DayClosePanelProps) {
  const targetDate = date || new Date();
  const { data: closeout, isLoading: closeoutLoading } = useDailyCloseout(officeId, targetDate);
  const { data: kpis } = useDailyKPIs(officeId, targetDate);
  const { data: variance } = useVarianceSummary(officeId, targetDate);
  const closeDay = useCloseDay();
  const unlockDay = useUnlockDay();
  
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmUnlock, setShowConfirmUnlock] = useState(false);

  const isDayClosed = closeout?.is_locked || false;

  const handleCloseDay = async () => {
    if (!kpis || !variance) return;
    
    await closeDay.mutateAsync({
      officeId,
      date: targetDate,
      summary: {
        totalBoxes: kpis.totalBoxes,
        totalTobaccoLbs: kpis.tobaccoUsed,
        totalTubesUsed: kpis.tubesUsed,
        totalDefects: kpis.totalDefects,
        varianceSummary: {
          tubes: { issued: variance.tubesIssued, used: variance.tubesUsed, variance: variance.tubesVariance },
          efficiency: variance.efficiencyPct,
          stickersByBrand: variance.stickersByBrand,
          boxesByBrand: variance.boxesByBrand,
        },
      },
    });
    setShowConfirmClose(false);
  };

  const handleUnlockDay = async () => {
    if (!closeout) return;
    await unlockDay.mutateAsync({ closeoutId: closeout.id, officeId });
    setShowConfirmUnlock(false);
  };

  if (closeoutLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn(isDayClosed && 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(targetDate, 'EEEE, MMMM d, yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDayClosed ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Day Closed</span>
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Closed {closeout?.closed_at ? format(new Date(closeout.closed_at), 'h:mm a') : ''}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <Unlock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Day Open</span>
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Editable
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {kpis?.totalBoxes || 0} boxes completed today
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDayClosed ? (
                isAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowConfirmUnlock(true)}
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    Unlock Day
                  </Button>
                )
              ) : (
                <Button 
                  size="sm"
                  onClick={() => setShowConfirmClose(true)}
                  disabled={!kpis || kpis.totalBoxes === 0}
                >
                  <Lock className="h-4 w-4 mr-1" />
                  Close Day
                </Button>
              )}
            </div>
          </div>

          {/* Day Summary when closed */}
          {isDayClosed && closeout && (
            <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{closeout.total_boxes}</p>
                <p className="text-xs text-muted-foreground">Total Boxes</p>
              </div>
              <div>
                <p className="text-xl font-bold">{closeout.total_tobacco_lbs}</p>
                <p className="text-xs text-muted-foreground">Tobacco (lbs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{closeout.total_tubes_used}</p>
                <p className="text-xs text-muted-foreground">Tubes Used</p>
              </div>
              <div>
                <p className="text-xl font-bold">{closeout.total_defects}</p>
                <p className="text-xs text-muted-foreground">Defects</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close Day Confirmation */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Close Production Day
            </DialogTitle>
            <DialogDescription>
              This will lock all batches for {format(targetDate, 'MMMM d, yyyy')} and prevent further edits.
            </DialogDescription>
          </DialogHeader>

          {kpis && (
            <div className="py-4 space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Day Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total Boxes: <strong>{kpis.totalBoxes}</strong></div>
                  <div>Tobacco Used: <strong>{kpis.tobaccoUsed} lbs</strong></div>
                  <div>Tubes Used: <strong>{kpis.tubesUsed}</strong></div>
                  <div>Defects: <strong>{kpis.totalDefects}</strong></div>
                  <div>Efficiency: <strong>{kpis.efficiencyPct}%</strong></div>
                  <div>Workers: <strong>{kpis.workersPresent}</strong></div>
                </div>
              </div>

              {variance && variance.tubesVariance !== 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Tube variance of {variance.tubesVariance > 0 ? '+' : ''}{variance.tubesVariance} will be recorded
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmClose(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCloseDay}
              disabled={closeDay.isPending}
            >
              <Lock className="h-4 w-4 mr-1" />
              Confirm Close Day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Day Confirmation */}
      <Dialog open={showConfirmUnlock} onOpenChange={setShowConfirmUnlock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5" />
              Unlock Production Day
            </DialogTitle>
            <DialogDescription>
              This will allow editing of batches for {format(targetDate, 'MMMM d, yyyy')}. 
              This action is logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmUnlock(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleUnlockDay}
              disabled={unlockDay.isPending}
            >
              <Unlock className="h-4 w-4 mr-1" />
              Confirm Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
