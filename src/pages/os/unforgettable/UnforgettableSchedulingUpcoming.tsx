import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Users, MapPin, UserPlus } from 'lucide-react';

const SIMULATED_UPCOMING_EVENTS = [
  { id: 'evt-101', name: 'Williams Baby Shower', date: 'Dec 28, 2025', venue: 'Garden Terrace', guests: 75, staffNeeded: 4, staffAssigned: 4 },
  { id: 'evt-102', name: 'Rodriguez Birthday Party', date: 'Dec 29, 2025', venue: 'Party Room A', guests: 50, staffNeeded: 3, staffAssigned: 3 },
  { id: 'evt-103', name: 'Smith Anniversary', date: 'Dec 30, 2025', venue: 'Crystal Hall', guests: 100, staffNeeded: 6, staffAssigned: 5 },
  { id: 'evt-104', name: 'New Year Gala', date: 'Dec 31, 2025', venue: 'Grand Ballroom', guests: 300, staffNeeded: 15, staffAssigned: 12 },
  { id: 'evt-105', name: 'Corporate Retreat', date: 'Jan 2, 2026', venue: 'Executive Suite', guests: 80, staffNeeded: 5, staffAssigned: 5 },
  { id: 'evt-106', name: 'Thompson Wedding', date: 'Jan 4, 2026', venue: 'Grand Ballroom', guests: 250, staffNeeded: 12, staffAssigned: 10 },
  { id: 'evt-107', name: 'Sweet 16 Party', date: 'Jan 5, 2026', venue: 'Party Room B', guests: 60, staffNeeded: 4, staffAssigned: 4 },
  { id: 'evt-108', name: 'Charity Gala', date: 'Jan 8, 2026', venue: 'Crystal Hall', guests: 180, staffNeeded: 10, staffAssigned: 8 },
];

export default function UnforgettableSchedulingUpcoming() {
  const navigate = useNavigate();
  
  const totalEvents = SIMULATED_UPCOMING_EVENTS.length;
  const totalStaffNeeded = SIMULATED_UPCOMING_EVENTS.reduce((sum, evt) => sum + evt.staffNeeded, 0);
  const totalStaffAssigned = SIMULATED_UPCOMING_EVENTS.reduce((sum, evt) => sum + evt.staffAssigned, 0);
  const eventsWithGaps = SIMULATED_UPCOMING_EVENTS.filter(evt => evt.staffAssigned < evt.staffNeeded).length;

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/scheduling')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-500 bg-clip-text text-transparent">
            Upcoming Events
          </h1>
          <p className="text-muted-foreground">
            {totalEvents} events • {totalStaffAssigned}/{totalStaffNeeded} staff assigned
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30">
          Simulated Data
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-pink-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Events</p>
            <p className="text-3xl font-bold">{totalEvents}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Staff Needed</p>
            <p className="text-3xl font-bold">{totalStaffNeeded}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Staff Assigned</p>
            <p className="text-3xl font-bold">{totalStaffAssigned}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Events with Gaps</p>
            <p className="text-3xl font-bold text-amber-600">{eventsWithGaps}</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-pink-500" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Event</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Venue</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Guests</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Staff</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {SIMULATED_UPCOMING_EVENTS.map((event) => {
                  const hasGap = event.staffAssigned < event.staffNeeded;
                  return (
                    <tr key={event.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{event.name}</td>
                      <td className="p-3 text-muted-foreground">{event.date}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {event.venue}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {event.guests}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={hasGap ? 'text-amber-600 font-medium' : ''}>
                          {event.staffAssigned}/{event.staffNeeded}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant="outline" 
                          className={hasGap 
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' 
                            : 'bg-green-500/10 text-green-600 border-green-500/30'
                          }
                        >
                          {hasGap ? 'Needs Staff' : 'Fully Staffed'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {hasGap && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/os/unforgettable/scheduling/gaps?eventId=${event.id}`)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
