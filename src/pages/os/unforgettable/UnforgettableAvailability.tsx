import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sunset
} from 'lucide-react';

// Mock availability data
const mockStaffAvailability = [
  { id: '1', name: 'Marcus Johnson', role: 'Lead DJ', mon: 'available', tue: 'available', wed: 'unavailable', thu: 'available', fri: 'available', sat: 'available', sun: 'partial' },
  { id: '2', name: 'Sarah Chen', role: 'Event Coordinator', mon: 'available', tue: 'available', wed: 'available', thu: 'available', fri: 'available', sat: 'partial', sun: 'unavailable' },
  { id: '3', name: 'Mike Torres', role: 'Bartender', mon: 'unavailable', tue: 'available', wed: 'available', thu: 'available', fri: 'available', sat: 'available', sun: 'available' },
  { id: '4', name: 'Jessica Williams', role: 'MC/Host', mon: 'partial', tue: 'available', wed: 'available', thu: 'unavailable', fri: 'available', sat: 'available', sun: 'available' },
  { id: '5', name: 'David Kim', role: 'Setup Crew Lead', mon: 'available', tue: 'available', wed: 'available', thu: 'available', fri: 'partial', sat: 'available', sun: 'unavailable' },
];

const mockTimeOffRequests = [
  { id: '1', name: 'Marcus Johnson', type: 'Vacation', startDate: '2024-02-15', endDate: '2024-02-20', status: 'pending', reason: 'Family vacation' },
  { id: '2', name: 'Sarah Chen', type: 'Personal', startDate: '2024-02-10', endDate: '2024-02-10', status: 'approved', reason: 'Doctor appointment' },
  { id: '3', name: 'Mike Torres', type: 'Sick', startDate: '2024-01-25', endDate: '2024-01-26', status: 'approved', reason: 'Flu' },
  { id: '4', name: 'Jessica Williams', type: 'Vacation', startDate: '2024-03-01', endDate: '2024-03-07', status: 'pending', reason: 'Spring break trip' },
];

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function UnforgettableAvailability() {
  const [currentWeek, setCurrentWeek] = useState('Jan 22 - Jan 28, 2024');

  const getAvailabilityIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case 'unavailable':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-amber-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
      case 'denied':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Vacation':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{type}</Badge>;
      case 'Sick':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{type}</Badge>;
      case 'Personal':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Availability</h1>
          <p className="text-muted-foreground">Manage schedules, availability, and time-off requests</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Today</p>
                <p className="text-2xl font-bold text-foreground">18</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-foreground">4</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <p className="text-2xl font-bold text-foreground">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week Coverage</p>
                <p className="text-2xl font-bold text-foreground">94%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calendar">Weekly Calendar</TabsTrigger>
          <TabsTrigger value="requests">Time-Off Requests</TabsTrigger>
          <TabsTrigger value="shifts">Shift Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <h3 className="font-semibold text-foreground">{currentWeek}</h3>
            <Button variant="outline" size="sm">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Availability Grid */}
          <Card className="bg-card border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Member</th>
                    {daysOfWeek.map(day => (
                      <th key={day} className="text-center p-4 text-sm font-medium text-muted-foreground">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockStaffAvailability.map((staff) => (
                    <tr key={staff.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role}</p>
                      </td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.mon)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.tue)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.wed)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.thu)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.fri)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.sat)}</td>
                      <td className="p-4 text-center">{getAvailabilityIcon(staff.sun)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-muted-foreground">Partial</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-muted-foreground">Unavailable</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Time-Off Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Member</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Dates</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Reason</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTimeOffRequests.map((request) => (
                    <tr key={request.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{request.name}</p>
                      </td>
                      <td className="p-4 text-center">{getTypeBadge(request.type)}</td>
                      <td className="p-4 text-center text-foreground">
                        {request.startDate === request.endDate 
                          ? request.startDate 
                          : `${request.startDate} - ${request.endDate}`}
                      </td>
                      <td className="p-4 text-muted-foreground">{request.reason}</td>
                      <td className="p-4 text-center">{getStatusBadge(request.status)}</td>
                      <td className="p-4 text-right">
                        {request.status === 'pending' && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Shift Preferences by Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockStaffAvailability.slice(0, 6).map((staff) => (
                  <div key={staff.id} className="p-4 rounded-lg border border-border bg-muted/30">
                    <p className="font-medium text-foreground">{staff.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">{staff.role}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4 text-amber-400" />
                        <span className="text-sm text-muted-foreground">Morning:</span>
                        <Badge variant="outline" className="ml-auto">Preferred</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sunset className="h-4 w-4 text-orange-400" />
                        <span className="text-sm text-muted-foreground">Afternoon:</span>
                        <Badge variant="outline" className="ml-auto">Available</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-muted-foreground">Evening:</span>
                        <Badge variant="outline" className="ml-auto">Preferred</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
