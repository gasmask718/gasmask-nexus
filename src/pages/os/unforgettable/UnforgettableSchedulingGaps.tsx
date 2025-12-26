import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Calendar, Users, MapPin, UserPlus, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const SIMULATED_GAPS = [
  {
    id: 'gap-001',
    eventId: 'evt-103',
    eventName: 'Smith Anniversary',
    date: 'Dec 30, 2025',
    venue: 'Crystal Hall',
    roleNeeded: 'Server',
    priority: 'high',
  },
  {
    id: 'gap-002',
    eventId: 'evt-104',
    eventName: 'New Year Gala',
    date: 'Dec 31, 2025',
    venue: 'Grand Ballroom',
    roleNeeded: 'Bartender',
    priority: 'critical',
  },
  {
    id: 'gap-003',
    eventId: 'evt-104',
    eventName: 'New Year Gala',
    date: 'Dec 31, 2025',
    venue: 'Grand Ballroom',
    roleNeeded: 'Security',
    priority: 'critical',
  },
  {
    id: 'gap-004',
    eventId: 'evt-104',
    eventName: 'New Year Gala',
    date: 'Dec 31, 2025',
    venue: 'Grand Ballroom',
    roleNeeded: 'Server',
    priority: 'high',
  },
  {
    id: 'gap-005',
    eventId: 'evt-106',
    eventName: 'Thompson Wedding',
    date: 'Jan 4, 2026',
    venue: 'Grand Ballroom',
    roleNeeded: 'Photographer',
    priority: 'medium',
  },
  {
    id: 'gap-006',
    eventId: 'evt-106',
    eventName: 'Thompson Wedding',
    date: 'Jan 4, 2026',
    venue: 'Grand Ballroom',
    roleNeeded: 'Decorator',
    priority: 'medium',
  },
  {
    id: 'gap-007',
    eventId: 'evt-108',
    eventName: 'Charity Gala',
    date: 'Jan 8, 2026',
    venue: 'Crystal Hall',
    roleNeeded: 'Event Coordinator',
    priority: 'high',
  },
  {
    id: 'gap-008',
    eventId: 'evt-108',
    eventName: 'Charity Gala',
    date: 'Jan 8, 2026',
    venue: 'Crystal Hall',
    roleNeeded: 'Bartender',
    priority: 'medium',
  },
];

const AVAILABLE_STAFF = [
  { id: 'avail-001', name: 'Alex Johnson', role: 'Server', available: true },
  { id: 'avail-002', name: 'Emma Davis', role: 'Bartender', available: true },
  { id: 'avail-003', name: 'Marcus Lee', role: 'Security', available: true },
  { id: 'avail-004', name: 'Sofia Hernandez', role: 'Event Coordinator', available: true },
  { id: 'avail-005', name: 'Ryan Murphy', role: 'Photographer', available: true },
];

export default function UnforgettableSchedulingGaps() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventIdFilter = searchParams.get('eventId');
  const [resolvedGaps, setResolvedGaps] = useState<string[]>([]);

  const filteredGaps = eventIdFilter 
    ? SIMULATED_GAPS.filter(g => g.eventId === eventIdFilter)
    : SIMULATED_GAPS;

  const activeGaps = filteredGaps.filter(g => !resolvedGaps.includes(g.id));
  const criticalCount = activeGaps.filter(g => g.priority === 'critical').length;
  const highCount = activeGaps.filter(g => g.priority === 'high').length;

  const handleAssignStaff = (gapId: string, staffName: string) => {
    setResolvedGaps(prev => [...prev, gapId]);
    toast.success(`${staffName} assigned successfully`);
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'high': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      default: return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/scheduling')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-red-500 bg-clip-text text-transparent">
            Staffing Gaps
          </h1>
          <p className="text-muted-foreground">
            {activeGaps.length} open positions need assignment
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30">
          Simulated Data
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Critical</p>
            <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">High Priority</p>
            <p className="text-3xl font-bold text-amber-600">{highCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Resolved Today</p>
            <p className="text-3xl font-bold text-green-600">{resolvedGaps.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gaps List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Open Staffing Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeGaps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">All gaps resolved!</p>
              <p className="text-sm">Great work on staffing all positions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGaps.map((gap) => (
                <div 
                  key={gap.id} 
                  className="p-4 rounded-lg border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={getPriorityStyles(gap.priority)}>
                        {gap.priority.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium">{gap.eventName}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {gap.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {gap.venue}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{gap.roleNeeded}</Badge>
                      <div className="flex gap-2">
                        {AVAILABLE_STAFF
                          .filter(s => s.role === gap.roleNeeded || s.role === 'Event Coordinator')
                          .slice(0, 2)
                          .map(staff => (
                            <Button
                              key={staff.id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleAssignStaff(gap.id, staff.name)}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              {staff.name.split(' ')[0]}
                            </Button>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-pink-500" />
            Available Staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {AVAILABLE_STAFF.map((staff) => (
              <div
                key={staff.id}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate(`/os/unforgettable/staff/${staff.id}`)}
              >
                <p className="font-medium text-sm">{staff.name}</p>
                <p className="text-xs text-muted-foreground">{staff.role}</p>
                <Badge variant="outline" className="mt-2 text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  Available
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
