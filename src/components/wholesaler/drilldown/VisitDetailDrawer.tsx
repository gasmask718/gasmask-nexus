import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, Clock, Eye, MapPin, AlertTriangle, 
  Lightbulb, User, Camera, CheckCircle, Plus
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import type { WholesalerVisit } from '@/hooks/useWholesalerIntelligence';

interface VisitDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'total' | 'days_since' | 'visibility' | 'visit';
  visits: WholesalerVisit[];
  selectedVisit?: WholesalerVisit | null;
  profile: any;
  onScheduleVisit?: () => void;
  onEditVisit?: (visit: WholesalerVisit) => void;
}

export function VisitDetailDrawer({
  open,
  onOpenChange,
  type,
  visits,
  selectedVisit,
  profile,
  onScheduleVisit,
  onEditVisit,
}: VisitDetailDrawerProps) {
  const lastVisit = visits[0];
  const daysSinceLastVisit = lastVisit 
    ? differenceInDays(new Date(), new Date(lastVisit.visit_date))
    : null;
  
  const visitFrequency = profile?.visit_frequency_days || 30;
  const isOverdue = daysSinceLastVisit !== null && daysSinceLastVisit > visitFrequency;

  const avgVisibility = visits.length > 0
    ? visits.reduce((sum, v) => sum + (v.visibility_score || 0), 0) / visits.filter(v => v.visibility_score).length
    : 0;

  const getVisitTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'routine': return 'bg-blue-500/20 text-blue-400';
      case 'sales': return 'bg-green-500/20 text-green-400';
      case 'issue': return 'bg-red-500/20 text-red-400';
      case 'audit': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getVisibilityColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-amber-400';
    return 'text-red-400';
  };

  const getTitle = () => {
    switch (type) {
      case 'total': return 'Visit History';
      case 'days_since': return 'Visit Schedule';
      case 'visibility': return 'Visibility Scores';
      case 'visit': return format(new Date(selectedVisit?.visit_date || new Date()), 'MMM d, yyyy');
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'total': return Calendar;
      case 'days_since': return Clock;
      case 'visibility': return Eye;
      case 'visit': return MapPin;
    }
  };

  const Icon = getIcon();

  const renderContent = () => {
    switch (type) {
      case 'total':
        // Group visits by month
        const visitsByMonth = visits.reduce((acc, visit) => {
          const month = format(new Date(visit.visit_date), 'MMMM yyyy');
          if (!acc[month]) acc[month] = [];
          acc[month].push(visit);
          return acc;
        }, {} as Record<string, WholesalerVisit[]>);

        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{visits.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Visits</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <p className="text-lg font-bold">
                  {visits.filter(v => v.visit_type === 'routine').length}
                </p>
                <p className="text-xs text-blue-400">Routine</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-lg font-bold">
                  {visits.filter(v => v.visit_type === 'sales').length}
                </p>
                <p className="text-xs text-green-400">Sales</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center">
                <p className="text-lg font-bold">
                  {visits.filter(v => v.visit_type === 'issue').length}
                </p>
                <p className="text-xs text-red-400">Issue</p>
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-400px)] mt-6">
              <div className="space-y-6">
                {Object.entries(visitsByMonth).map(([month, monthVisits]) => (
                  <div key={month}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {month} ({monthVisits.length})
                    </p>
                    <div className="space-y-2">
                      {monthVisits.map((visit) => (
                        <div
                          key={visit.id}
                          onClick={() => onEditVisit?.(visit)}
                          className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getVisitTypeColor(visit.visit_type)}>
                              {visit.visit_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {visit.observations && (
                            <p className="text-xs text-muted-foreground truncate">
                              {visit.observations}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        );

      case 'days_since':
        return (
          <>
            <div className={`p-6 rounded-xl border ${isOverdue 
              ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20' 
              : 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20'
            }`}>
              <div className="text-center">
                <p className="text-4xl font-bold">{daysSinceLastVisit ?? '-'}</p>
                <p className="text-sm text-muted-foreground mt-1">Days Since Last Visit</p>
                {isOverdue && (
                  <p className="text-xs text-amber-400 mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {(daysSinceLastVisit || 0) - visitFrequency} days overdue
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Visit Frequency</span>
                  <span className="text-sm font-medium">Every {visitFrequency} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Next Due</span>
                  <span className={`text-sm font-medium ${isOverdue ? 'text-amber-400' : 'text-green-400'}`}>
                    {isOverdue ? 'Overdue' : lastVisit 
                      ? format(new Date(new Date(lastVisit.visit_date).getTime() + visitFrequency * 24 * 60 * 60 * 1000), 'MMM d, yyyy')
                      : 'Schedule now'
                    }
                  </span>
                </div>
              </div>

              {lastVisit && (
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Last Visit</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getVisitTypeColor(lastVisit.visit_type)}>
                        {lastVisit.visit_type}
                      </Badge>
                      <span className="text-sm">
                        {format(new Date(lastVisit.visit_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {lastVisit.visibility_score && (
                      <span className={`text-sm font-medium ${getVisibilityColor(lastVisit.visibility_score)}`}>
                        <Eye className="h-3 w-3 inline mr-1" />
                        {lastVisit.visibility_score}/10
                      </span>
                    )}
                  </div>
                  {lastVisit.observations && (
                    <p className="text-xs text-muted-foreground mt-2">{lastVisit.observations}</p>
                  )}
                </div>
              )}
            </div>

            {onScheduleVisit && (
              <Button className="w-full mt-6" onClick={onScheduleVisit}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Visit
              </Button>
            )}
          </>
        );

      case 'visibility':
        const visitsWithScores = visits.filter(v => v.visibility_score);
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{avgVisibility.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground mt-1">Average Visibility Score</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-lg font-bold">
                  {visitsWithScores.filter(v => (v.visibility_score || 0) >= 8).length}
                </p>
                <p className="text-xs text-green-400">High (8-10)</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <p className="text-lg font-bold">
                  {visitsWithScores.filter(v => (v.visibility_score || 0) >= 5 && (v.visibility_score || 0) < 8).length}
                </p>
                <p className="text-xs text-amber-400">Medium (5-7)</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center">
                <p className="text-lg font-bold">
                  {visitsWithScores.filter(v => (v.visibility_score || 0) < 5).length}
                </p>
                <p className="text-xs text-red-400">Low (&lt;5)</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Visibility Trend
              </p>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {visitsWithScores.slice(0, 10).map((visit) => (
                    <div
                      key={visit.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                        </p>
                        <Badge className={`${getVisitTypeColor(visit.visit_type)} text-xs`}>
                          {visit.visit_type}
                        </Badge>
                      </div>
                      <div className={`text-2xl font-bold ${getVisibilityColor(visit.visibility_score || 0)}`}>
                        {visit.visibility_score}/10
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        );

      case 'visit':
        if (!selectedVisit) return null;
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <Badge className={`${getVisitTypeColor(selectedVisit.visit_type)} text-sm`}>
                  {selectedVisit.visit_type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedVisit.duration_minutes} min
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <Eye className="h-5 w-5 mx-auto text-green-400 mb-2" />
                <p className={`text-2xl font-bold ${getVisibilityColor(selectedVisit.visibility_score || 0)}`}>
                  {selectedVisit.visibility_score ?? '-'}/10
                </p>
                <p className="text-xs text-muted-foreground">Visibility</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <Clock className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                <p className="text-2xl font-bold">{selectedVisit.duration_minutes}</p>
                <p className="text-xs text-muted-foreground">Minutes</p>
              </div>
            </div>

            {selectedVisit.observations && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Observations</p>
                <p className="text-sm">{selectedVisit.observations}</p>
              </div>
            )}

            {selectedVisit.placement_feedback && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Placement Feedback</p>
                <p className="text-sm">{selectedVisit.placement_feedback}</p>
              </div>
            )}

            {selectedVisit.issues_found && selectedVisit.issues_found.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <p className="text-sm font-medium text-red-400">Issues Found</p>
                </div>
                <ul className="text-sm space-y-1">
                  {selectedVisit.issues_found.map((issue, i) => (
                    <li key={i} className="text-muted-foreground">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedVisit.opportunities && selectedVisit.opportunities.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-green-400" />
                  <p className="text-sm font-medium text-green-400">Opportunities</p>
                </div>
                <ul className="text-sm space-y-1">
                  {selectedVisit.opportunities.map((opp, i) => (
                    <li key={i} className="text-muted-foreground">• {opp}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedVisit.follow_up_required && (
              <div className="mt-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-medium text-amber-400">Follow-up Required</p>
                </div>
                {selectedVisit.follow_up_notes && (
                  <p className="text-sm text-muted-foreground">{selectedVisit.follow_up_notes}</p>
                )}
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-muted/50">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">{getTitle()}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Field visit analysis
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
