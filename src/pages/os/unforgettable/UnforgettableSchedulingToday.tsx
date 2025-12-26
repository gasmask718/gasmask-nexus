import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Users, Clock, MapPin, Phone } from 'lucide-react';

const SIMULATED_TODAY_EVENTS = [
  {
    id: 'evt-001',
    name: 'Johnson Wedding Reception',
    time: '2:00 PM - 10:00 PM',
    venue: 'Grand Ballroom',
    guests: 200,
    staffAssigned: [
      { id: 'stf-001', name: 'Maria Garcia', role: 'Event Coordinator', phone: '(555) 123-4567' },
      { id: 'stf-002', name: 'James Wilson', role: 'DJ', phone: '(555) 234-5678' },
      { id: 'stf-003', name: 'Sarah Chen', role: 'Lead Server', phone: '(555) 345-6789' },
      { id: 'stf-004', name: 'Michael Brown', role: 'Bartender', phone: '(555) 456-7890' },
    ],
    status: 'in_progress',
  },
  {
    id: 'evt-002',
    name: 'Tech Corp Holiday Party',
    time: '6:00 PM - 11:00 PM',
    venue: 'Crystal Hall',
    guests: 150,
    staffAssigned: [
      { id: 'stf-005', name: 'David Lee', role: 'Event Coordinator', phone: '(555) 567-8901' },
      { id: 'stf-006', name: 'Emily Rodriguez', role: 'DJ', phone: '(555) 678-9012' },
      { id: 'stf-007', name: 'Chris Taylor', role: 'Photographer', phone: '(555) 789-0123' },
    ],
    status: 'upcoming',
  },
  {
    id: 'evt-003',
    name: 'Martinez Quinceañera',
    time: '4:00 PM - 9:00 PM',
    venue: 'Garden Terrace',
    guests: 120,
    staffAssigned: [
      { id: 'stf-008', name: 'Ana Martinez', role: 'Event Coordinator', phone: '(555) 890-1234' },
      { id: 'stf-009', name: 'Ricardo Gomez', role: 'MC', phone: '(555) 901-2345' },
      { id: 'stf-010', name: 'Lisa Wong', role: 'Decorator', phone: '(555) 012-3456' },
      { id: 'stf-011', name: 'John Smith', role: 'Security', phone: '(555) 123-4568' },
      { id: 'stf-012', name: 'Kelly Adams', role: 'Server', phone: '(555) 234-5679' },
    ],
    status: 'upcoming',
  },
];

export default function UnforgettableSchedulingToday() {
  const navigate = useNavigate();
  
  const totalStaff = SIMULATED_TODAY_EVENTS.reduce((sum, evt) => sum + evt.staffAssigned.length, 0);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/scheduling')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-500 bg-clip-text text-transparent">
            Today's Schedule
          </h1>
          <p className="text-muted-foreground">
            {SIMULATED_TODAY_EVENTS.length} events • {totalStaff} staff assigned
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 border-amber-500/30">
          Simulated Data
        </Badge>
      </div>

      {/* Events */}
      <div className="space-y-4">
        {SIMULATED_TODAY_EVENTS.map((event) => (
          <Card key={event.id} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-pink-500" />
                  {event.name}
                </CardTitle>
                <Badge 
                  variant="outline" 
                  className={event.status === 'in_progress' 
                    ? 'bg-green-500/10 text-green-600 border-green-500/30' 
                    : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                  }
                >
                  {event.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {event.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.venue}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {event.guests} guests
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <h4 className="text-sm font-medium mb-3">Assigned Staff ({event.staffAssigned.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {event.staffAssigned.map((staff) => (
                  <div
                    key={staff.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/os/unforgettable/staff/${staff.id}`)}
                  >
                    <p className="font-medium text-sm">{staff.name}</p>
                    <p className="text-xs text-muted-foreground">{staff.role}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {staff.phone}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
