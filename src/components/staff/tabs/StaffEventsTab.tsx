/**
 * StaffEventsTab
 * 
 * SYSTEM LAW: Tabs are views into data, not decorations.
 * Shows every event this staff member is associated with.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, Clock, MapPin, User, ChevronRight, 
  CheckCircle, XCircle, AlertCircle, Loader2 
} from "lucide-react";
import { useStaffEvents, UTEventStaff } from '@/hooks/useUnforgettableStaffTabs';
import { format, parseISO, isPast, isFuture } from 'date-fns';

interface StaffEventsTabProps {
  staffId: string;
}

export default function StaffEventsTab({ staffId }: StaffEventsTabProps) {
  const { data: events, isLoading, error } = useStaffEvents(staffId);

  const getStatusBadge = (status: UTEventStaff['status']) => {
    const config: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
      assigned: { class: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Clock className="h-3 w-3" />, label: 'Assigned' },
      confirmed: { class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle className="h-3 w-3" />, label: 'Confirmed' },
      checked_in: { class: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: <User className="h-3 w-3" />, label: 'Checked In' },
      completed: { class: 'bg-green-500/10 text-green-600 border-green-500/20', icon: <CheckCircle className="h-3 w-3" />, label: 'Completed' },
      no_show: { class: 'bg-red-500/10 text-red-600 border-red-500/20', icon: <XCircle className="h-3 w-3" />, label: 'No Show' },
      cancelled: { class: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: <AlertCircle className="h-3 w-3" />, label: 'Cancelled' },
    };
    const { class: className, icon, label } = config[status] || config.assigned;
    return (
      <Badge variant="outline" className={`${className} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const getEventTimeBadge = (eventDate: string) => {
    const date = parseISO(eventDate);
    if (isPast(date)) {
      return <Badge variant="secondary" className="text-xs">Past</Badge>;
    }
    if (isFuture(date)) {
      return <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20 text-xs">Upcoming</Badge>;
    }
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">Today</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-pink-500" />
            Event History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load events</p>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-pink-500" />
            Event History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium mb-1">No events yet</p>
            <p className="text-sm">This staff member hasn't been assigned to any events.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Split into upcoming and past
  const upcomingEvents = events.filter(e => e.event && isFuture(parseISO(e.event.event_date)));
  const pastEvents = events.filter(e => e.event && isPast(parseISO(e.event.event_date)));

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-pink-500">{events.length}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">
              {events.filter(e => e.status === 'completed').length}
            </p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{upcomingEvents.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {events.reduce((sum, e) => sum + (e.hours_worked || 0), 0).toFixed(1)}h
            </p>
            <p className="text-xs text-muted-foreground">Total Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-pink-500" />
              Upcoming Events ({upcomingEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.map((assignment) => (
              <EventRow key={assignment.id} assignment={assignment} getStatusBadge={getStatusBadge} getEventTimeBadge={getEventTimeBadge} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Past Events */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Past Events ({pastEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pastEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No past events</p>
          ) : (
            pastEvents.slice(0, 10).map((assignment) => (
              <EventRow key={assignment.id} assignment={assignment} getStatusBadge={getStatusBadge} getEventTimeBadge={getEventTimeBadge} />
            ))
          )}
          {pastEvents.length > 10 && (
            <Button variant="outline" className="w-full mt-2">
              View All Past Events ({pastEvents.length})
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({ 
  assignment, 
  getStatusBadge, 
  getEventTimeBadge 
}: { 
  assignment: UTEventStaff; 
  getStatusBadge: (status: UTEventStaff['status']) => React.ReactNode;
  getEventTimeBadge: (date: string) => React.ReactNode;
}) {
  const event = assignment.event;
  if (!event) return null;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
        <Calendar className="h-5 w-5 text-pink-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{event.event_name}</h4>
          {getEventTimeBadge(event.event_date)}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(parseISO(event.event_date), 'MMM d, yyyy')}
          </span>
          {event.venue_name && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              {event.venue_name}
            </span>
          )}
          {assignment.role_at_event && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {assignment.role_at_event}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {assignment.hours_worked && (
          <span className="text-sm font-medium">{assignment.hours_worked.toFixed(1)}h</span>
        )}
        {getStatusBadge(assignment.status)}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
