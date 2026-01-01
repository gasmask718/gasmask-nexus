/**
 * StaffPerformanceTab - SYSTEM LAW: Tabs are views into data, not decorations.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, Star, Calendar, Clock, DollarSign, Award, Target, CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { useStaffPerformance, useRecalculateAttendance } from '@/hooks/useUnforgettableStaffTabs';

interface StaffPerformanceTabProps {
  staffId: string;
  rating?: number | null;
  eventsCompleted?: number | null;
  totalEarnings?: number | null;
}

export default function StaffPerformanceTab({ staffId, rating, eventsCompleted, totalEarnings }: StaffPerformanceTabProps) {
  const { metrics, isLoading } = useStaffPerformance(staffId);
  const recalculateAttendance = useRecalculateAttendance();

  if (isLoading) {
    return (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}</div><Skeleton className="h-64 rounded-lg" /></div>);
  }

  const displayMetrics = {
    totalEvents: metrics?.totalEvents ?? eventsCompleted ?? 0,
    completedEvents: metrics?.completedEvents ?? eventsCompleted ?? 0,
    attendanceRate: metrics?.attendanceRate ?? 100,
    totalHoursWorked: metrics?.totalHoursWorked ?? 0,
    avgHoursPerEvent: metrics?.avgHoursPerEvent ?? 0,
    totalEarnings: metrics?.totalEarnings ?? totalEarnings ?? 0,
    avgEarningsPerEvent: metrics?.avgEarningsPerEvent ?? 0,
    rating: rating ?? metrics?.rating ?? null,
    noShowEvents: metrics?.noShowEvents ?? 0,
    cancelledEvents: metrics?.cancelledEvents ?? 0,
  };

  const getAttendanceColor = (rate: number) => rate >= 95 ? 'text-emerald-500' : rate >= 85 ? 'text-amber-500' : 'text-red-500';

  const getRatingStars = (r: number | null) => {
    if (!r) return null;
    return (<div className="flex items-center gap-0.5">{[...Array(5)].map((_, i) => (<Star key={i} className={`h-4 w-4 ${i < Math.floor(r) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />))}</div>);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50"><CardContent className="p-4 text-center"><Target className="h-5 w-5 text-pink-500 mx-auto mb-2" /><p className="text-2xl font-bold">{displayMetrics.totalEvents}</p><p className="text-xs text-muted-foreground">Total Events</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4 text-center"><CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-2" /><p className={`text-2xl font-bold ${getAttendanceColor(displayMetrics.attendanceRate)}`}>{displayMetrics.attendanceRate.toFixed(0)}%</p><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4 text-center"><Clock className="h-5 w-5 text-blue-500 mx-auto mb-2" /><p className="text-2xl font-bold">{displayMetrics.totalHoursWorked.toFixed(0)}h</p><p className="text-xs text-muted-foreground">Total Hours</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4 text-center"><DollarSign className="h-5 w-5 text-emerald-500 mx-auto mb-2" /><p className="text-2xl font-bold">${displayMetrics.totalEarnings.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Earnings</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => recalculateAttendance.mutate(staffId)} disabled={recalculateAttendance.isPending}>
          {recalculateAttendance.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Update Attendance Rating
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Rating & Reliability</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div><div className="flex justify-between items-center mb-2"><span className="text-sm">Overall Rating</span><div className="flex items-center gap-2">{getRatingStars(displayMetrics.rating)}<span className="text-sm font-medium">{displayMetrics.rating?.toFixed(1) ?? '-'} / 5.0</span></div></div><Progress value={displayMetrics.rating ? (displayMetrics.rating / 5) * 100 : 0} className="h-2" /></div>
            <div><div className="flex justify-between items-center mb-2"><span className="text-sm">Attendance Rate</span><span className={`text-sm font-medium ${getAttendanceColor(displayMetrics.attendanceRate)}`}>{displayMetrics.attendanceRate.toFixed(0)}%</span></div><Progress value={displayMetrics.attendanceRate} className="h-2" /></div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-2 rounded-lg bg-emerald-500/10"><CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" /><p className="text-lg font-bold">{displayMetrics.completedEvents}</p><p className="text-xs text-muted-foreground">Completed</p></div>
              <div className="text-center p-2 rounded-lg bg-gray-500/10"><XCircle className="h-4 w-4 text-gray-500 mx-auto mb-1" /><p className="text-lg font-bold">{displayMetrics.cancelledEvents}</p><p className="text-xs text-muted-foreground">Cancelled</p></div>
              <div className="text-center p-2 rounded-lg bg-red-500/10"><AlertCircle className="h-4 w-4 text-red-500 mx-auto mb-1" /><p className="text-lg font-bold">{displayMetrics.noShowEvents}</p><p className="text-xs text-muted-foreground">No Shows</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-pink-500" />Productivity Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50"><div><p className="text-sm text-muted-foreground">Avg Hours per Event</p><p className="text-xl font-bold">{displayMetrics.avgHoursPerEvent.toFixed(1)}h</p></div><Clock className="h-8 w-8 text-blue-500/30" /></div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50"><div><p className="text-sm text-muted-foreground">Avg Earnings per Event</p><p className="text-xl font-bold">${displayMetrics.avgEarningsPerEvent.toFixed(0)}</p></div><DollarSign className="h-8 w-8 text-emerald-500/30" /></div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50"><div><p className="text-sm text-muted-foreground">Events Completed</p><p className="text-xl font-bold">{displayMetrics.completedEvents}</p></div><Calendar className="h-8 w-8 text-pink-500/30" /></div>
            {displayMetrics.attendanceRate >= 95 && displayMetrics.completedEvents >= 10 && (<div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"><Award className="h-5 w-5 text-amber-500" /><div><p className="text-sm font-medium text-amber-600">Top Performer</p><p className="text-xs text-muted-foreground">High attendance & experience</p></div></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
