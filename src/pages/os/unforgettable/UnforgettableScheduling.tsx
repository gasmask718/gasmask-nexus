import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Users, MapPin, CheckCircle, AlertCircle, Plus, Search, ChevronRight, DollarSign } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { STAFF_DEPARTMENTS, STAFF_ROLES, type UTStaffRole } from '@/config/unforgettableStaffConfig';

// Mock events data
const generateMockEvents = () => {
  const eventTypes = ['Wedding', 'Corporate Gala', 'Birthday Party', 'Quinceañera', 'Anniversary', 'Baby Shower', 'Graduation Party'];
  const venues = ['Grand Ballroom', 'Sunset Terrace', 'Garden Pavilion', 'Rooftop Lounge', 'Crystal Hall'];
  const clients = ['Johnson Family', 'Smith Corp', 'Garcia Wedding', 'Tech Solutions Inc', 'Williams Celebration'];
  
  const events = [];
  const today = new Date();
  
  for (let i = 0; i < 12; i++) {
    const eventDate = addDays(today, Math.floor(Math.random() * 14) - 2);
    const guestCount = Math.floor(Math.random() * 300) + 50;
    const staffNeeded = Math.ceil(guestCount / 25);
    const staffAssigned = Math.floor(Math.random() * staffNeeded);
    
    events.push({
      id: `event-${i + 1}`,
      name: `${clients[i % clients.length]} ${eventTypes[i % eventTypes.length]}`,
      type: eventTypes[i % eventTypes.length],
      date: eventDate,
      startTime: `${14 + (i % 6)}:00`,
      endTime: `${20 + (i % 4)}:00`,
      venue: venues[i % venues.length],
      client: clients[i % clients.length],
      guestCount,
      staffNeeded,
      staffAssigned,
      status: staffAssigned >= staffNeeded ? 'fully_staffed' : staffAssigned > 0 ? 'partial' : 'unstaffed',
      budget: guestCount * 150,
      assignments: generateMockAssignments(staffAssigned)
    });
  }
  
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
};

const generateMockAssignments = (count: number) => {
  const roles = Object.keys(STAFF_ROLES);
  const names = ['Marcus Johnson', 'Sofia Rodriguez', 'James Wilson', 'Maria Santos', 'David Lee', 'Angela Brown'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `assign-${i}`,
    staffId: `staff-${i}`,
    staffName: names[i % names.length],
    role: roles[Math.floor(Math.random() * roles.length)],
    status: Math.random() > 0.2 ? 'confirmed' : 'pending',
    checkIn: null,
    checkOut: null
  }));
};

const generateAvailableStaff = () => {
  const names = ['Marcus Johnson', 'Sofia Rodriguez', 'James Wilson', 'Maria Santos', 'David Lee', 'Angela Brown', 'Chris Taylor', 'Diana Martinez'];
  const roles = Object.keys(STAFF_ROLES);
  
  return names.map((name, i) => ({
    id: `avail-${i}`,
    name,
    role: roles[i % roles.length],
    rating: (4 + Math.random()).toFixed(1),
    eventsCompleted: Math.floor(Math.random() * 50) + 5,
    hourlyRate: 25 + Math.floor(Math.random() * 30),
    available: Math.random() > 0.3
  }));
};

const UnforgettableScheduling: React.FC = () => {
  const [events] = useState(generateMockEvents);
  const [availableStaff] = useState(generateAvailableStaff);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.venue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalEvents: events.length,
    fullyStaffed: events.filter(e => e.status === 'fully_staffed').length,
    needsStaff: events.filter(e => e.status !== 'fully_staffed').length,
    upcomingToday: events.filter(e => isToday(e.date)).length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fully_staffed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'partial': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'unstaffed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const selectedEventData = events.find(e => e.id === selectedEvent);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Scheduling</h1>
          <p className="text-muted-foreground">Manage event staffing and assignments</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalEvents}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.fullyStaffed}</p>
                <p className="text-sm text-muted-foreground">Fully Staffed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.needsStaff}</p>
                <p className="text-sm text-muted-foreground">Needs Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.upcomingToday}</p>
                <p className="text-sm text-muted-foreground">Today's Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">Event List</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`min-h-[200px] p-2 rounded-lg border ${
                        isToday(day) ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className={`text-sm font-medium mb-2 ${isToday(day) ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(day, 'EEE d')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event.id)}
                            className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                              selectedEvent === event.id ? 'ring-2 ring-primary' : ''
                            } ${getStatusColor(event.status)}`}
                          >
                            <p className="font-medium truncate">{event.name}</p>
                            <p className="opacity-70">{event.startTime}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="h-3 w-3" />
                              <span>{event.staffAssigned}/{event.staffNeeded}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Event Detail Panel */}
          {selectedEventData && (
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedEventData.name}</CardTitle>
                    <p className="text-muted-foreground">
                      {format(selectedEventData.date, 'EEEE, MMMM d, yyyy')} • {selectedEventData.startTime} - {selectedEventData.endTime}
                    </p>
                  </div>
                  <Badge className={getStatusColor(selectedEventData.status)}>
                    {selectedEventData.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEventData.venue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEventData.guestCount} guests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEventData.staffAssigned}/{selectedEventData.staffNeeded} staff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">${selectedEventData.budget.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Assigned Staff */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      Assigned Staff ({selectedEventData.assignments.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEventData.assignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div>
                            <p className="font-medium text-sm">{assignment.staffName}</p>
                            <p className="text-xs text-muted-foreground">
                              {STAFF_ROLES[assignment.role as UTStaffRole]?.displayName || assignment.role}
                            </p>
                          </div>
                          <Badge variant={assignment.status === 'confirmed' ? 'default' : 'outline'} className="text-xs">
                            {assignment.status}
                          </Badge>
                        </div>
                      ))}
                      {selectedEventData.assignments.length === 0 && (
                        <p className="text-sm text-muted-foreground">No staff assigned yet</p>
                      )}
                    </div>
                  </div>

                  {/* Available Staff */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Available Staff
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {availableStaff.filter(s => s.available).map(staff => (
                        <div key={staff.id} className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer">
                          <div>
                            <p className="font-medium text-sm">{staff.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {STAFF_ROLES[staff.role as UTStaffRole]?.displayName || staff.role} • ⭐ {staff.rating}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Event List View */}
        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="fully_staffed">Fully Staffed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unstaffed">Unstaffed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filteredEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event.id)}
                    className="p-4 hover:bg-muted/30 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-primary">{format(event.date, 'd')}</p>
                        <p className="text-xs text-muted-foreground">{format(event.date, 'MMM')}</p>
                      </div>
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.startTime} - {event.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {event.guestCount} guests
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">{event.staffAssigned}/{event.staffNeeded} staff</p>
                        <Badge className={`text-xs ${getStatusColor(event.status)}`}>
                          {event.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Overview */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {STAFF_DEPARTMENTS.slice(0, 6).map((dept) => {
              const deptRoles = Object.entries(STAFF_ROLES).filter(([_, r]) => r.department === dept.id);
              const totalAssigned = Math.floor(Math.random() * 20);
              const DeptIcon = dept.icon;
              
              return (
                <Card key={dept.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DeptIcon className={`h-5 w-5 ${dept.color}`} />
                      {dept.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Staff Assigned</span>
                        <span className="font-medium">{totalAssigned}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Roles</span>
                        <span className="font-medium">{deptRoles.length}</span>
                      </div>
                      <div className="pt-2 space-y-1">
                        {deptRoles.slice(0, 3).map(([roleKey, role]) => (
                          <div key={roleKey} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{role.displayName}</span>
                            <span>{Math.floor(Math.random() * 5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnforgettableScheduling;
