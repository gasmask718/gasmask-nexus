import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Phone, Mail, Calendar, DollarSign, Star, Clock, 
  MapPin, FileText, Edit, MessageSquare, CalendarPlus, 
  Award, TrendingUp, CheckCircle, AlertCircle, User, Briefcase
} from "lucide-react";
import { 
  STAFF_ROLES, 
  STAFF_CATEGORIES,
  STAFF_STATUSES,
  STAFF_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  getRoleDisplayName,
  type UTStaffRole,
  type UTStaffCategory,
  type UTStaffStatus,
  type UTEmploymentType
} from '@/config/unforgettableStaffConfig';

// Mock staff profile data
const generateMockStaffProfile = (id: string) => {
  const roleKeys = Object.keys(STAFF_ROLES) as UTStaffRole[];
  const idx = parseInt(id.replace('staff-', '')) - 1 || 0;
  const role = roleKeys[idx % roleKeys.length];
  const roleInfo = STAFF_ROLES[role];
  
  const firstNames = ['Maria', 'Carlos', 'Jessica', 'David', 'Sofia', 'Michael', 'Angela', 'Roberto'];
  const lastNames = ['Rodriguez', 'Martinez', 'Garcia', 'Johnson', 'Williams', 'Brown', 'Davis', 'Lopez'];
  
  const firstName = firstNames[idx % firstNames.length];
  const lastName = lastNames[idx % lastNames.length];
  
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@unforgettable.com`,
    phone: `(555) ${String(100 + idx).padStart(3, '0')}-${String(1000 + idx * 11).slice(0, 4)}`,
    role,
    category: roleInfo.defaultCategory,
    employment_type: roleInfo.defaultEmploymentType,
    status: 'active' as UTStaffStatus,
    department: roleInfo.department,
    hourly_rate: roleInfo.typicalHourlyRate?.min ? 
      roleInfo.typicalHourlyRate.min + Math.random() * (roleInfo.typicalHourlyRate.max - roleInfo.typicalHourlyRate.min) : null,
    event_rate: roleInfo.typicalEventRate?.min ? 
      roleInfo.typicalEventRate.min + Math.random() * (roleInfo.typicalEventRate.max - roleInfo.typicalEventRate.min) : null,
    events_completed: Math.floor(Math.random() * 50) + 5,
    rating: 4 + Math.random(),
    hire_date: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
    total_earnings: Math.floor(Math.random() * 15000) + 2000,
    address: '123 Event Way, Miami, FL 33101',
    emergency_contact: 'John Doe - (555) 999-8888',
    notes: 'Excellent team player, always punctual.',
    certifications: roleInfo.requiredCertifications || [],
    skills: ['Event Setup', 'Customer Service', 'Team Coordination'],
    languages: ['English', 'Spanish'],
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    },
    upcoming_events: [
      { id: 'evt-1', name: 'Garcia Wedding Reception', date: '2024-02-15', venue: 'Grand Ballroom', role: role },
      { id: 'evt-2', name: 'Corporate Holiday Party', date: '2024-02-22', venue: 'Skyline Terrace', role: role },
      { id: 'evt-3', name: 'Sweet 16 - Martinez', date: '2024-03-01', venue: 'Paradise Hall', role: role }
    ],
    past_events: [
      { id: 'evt-10', name: 'Johnson Anniversary', date: '2024-01-20', venue: 'Ocean View', rating: 5, payout: 350 },
      { id: 'evt-11', name: 'NYE Gala 2024', date: '2024-01-01', venue: 'Grand Ballroom', rating: 4.8, payout: 500 },
      { id: 'evt-12', name: 'Williams Quinceañera', date: '2023-12-15', venue: 'Casa Bella', rating: 5, payout: 300 }
    ],
    payment_history: [
      { id: 'pay-1', date: '2024-01-25', amount: 850, status: 'paid', events: 3 },
      { id: 'pay-2', date: '2024-01-10', amount: 650, status: 'paid', events: 2 },
      { id: 'pay-3', date: '2023-12-22', amount: 1200, status: 'paid', events: 4 }
    ],
    performance_metrics: {
      punctuality: 98,
      client_satisfaction: 96,
      reliability: 95,
      teamwork: 92
    }
  };
};

export default function UnforgettableStaffProfile() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const staff = useMemo(() => generateMockStaffProfile(staffId || 'staff-1'), [staffId]);
  const roleInfo = STAFF_ROLES[staff.role];
  const deptInfo = STAFF_DEPARTMENTS.find(d => d.id === staff.department);
  const RoleIcon = roleInfo?.icon || User;

  const getStatusBadge = (status: UTStaffStatus) => {
    const statusInfo = STAFF_STATUSES[status];
    const colorMap: Record<string, string> = {
      'bg-emerald-500': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'bg-gray-500': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      'bg-amber-500': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'bg-blue-500': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'bg-red-500': 'bg-red-500/10 text-red-600 border-red-500/20'
    };
    return colorMap[statusInfo?.color || 'bg-gray-500'] || 'bg-muted text-muted-foreground';
  };

  const getCategoryBadge = (category: UTStaffCategory) => {
    const categoryInfo = STAFF_CATEGORIES[category];
    const colorMap: Record<string, string> = {
      'bg-blue-500': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'bg-purple-500': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'bg-amber-500': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'bg-emerald-500': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    };
    return colorMap[categoryInfo?.color || 'bg-gray-500'] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/os/unforgettable/staff')}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Staff
      </Button>

      {/* Profile Header */}
      <Card className="border-border/50 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-pink-600 to-purple-500" />
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6 -mt-12">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarFallback className="text-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white">
                {staff.first_name[0]}{staff.last_name[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 pt-4 md:pt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{staff.first_name} {staff.last_name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <RoleIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{getRoleDisplayName(staff.role)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={getStatusBadge(staff.status)}>
                      {STAFF_STATUSES[staff.status]?.displayName}
                    </Badge>
                    <Badge variant="outline" className={getCategoryBadge(staff.category)}>
                      {STAFF_CATEGORIES[staff.category]?.displayName}
                    </Badge>
                    <Badge variant="secondary">
                      {EMPLOYMENT_TYPES[staff.employment_type]?.displayName}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                  <Button className="bg-gradient-to-r from-pink-600 to-purple-500" size="sm">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Assign to Event
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 text-pink-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.events_completed}</p>
            <p className="text-xs text-muted-foreground">Events Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.rating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">${staff.total_earnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Earnings</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.hourly_rate ? `$${staff.hourly_rate.toFixed(0)}` : 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Hourly Rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.event_rate ? `$${staff.event_rate.toFixed(0)}` : 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Event Rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 text-rose-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.certifications.length}</p>
            <p className="text-xs text-muted-foreground">Certifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-pink-500" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{staff.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{staff.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{staff.address}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Emergency Contact</p>
                    <p className="text-sm">{staff.emergency_contact}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employment Details */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-pink-500" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Department</span>
                  <span className="text-sm font-medium">{deptInfo?.name || staff.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <span className="text-sm font-medium">{getRoleDisplayName(staff.role)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Employment Type</span>
                  <span className="text-sm font-medium">{EMPLOYMENT_TYPES[staff.employment_type]?.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Hire Date</span>
                  <span className="text-sm font-medium">{new Date(staff.hire_date).toLocaleDateString()}</span>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-1">
                    {staff.certifications.length > 0 ? (
                      staff.certifications.map((cert, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{cert}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No certifications required</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Availability */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-pink-500" />
                  Weekly Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(staff.availability).map(([day, available]) => (
                    <div key={day} className="text-center">
                      <p className="text-xs text-muted-foreground capitalize">{day.slice(0, 3)}</p>
                      <div className={`mt-1 p-2 rounded ${available ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                        {available ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Off</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Skills & Languages */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-pink-500" />
                  Skills & Languages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {staff.skills.map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Languages</p>
                  <div className="flex flex-wrap gap-1">
                    {staff.languages.map((lang, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm">{staff.notes}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-pink-500" />
                  Upcoming Events ({staff.upcoming_events.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {staff.upcoming_events.map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.venue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{new Date(event.date).toLocaleDateString()}</p>
                      <Badge variant="outline" className="text-xs">{getRoleDisplayName(event.role)}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Past Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {staff.past_events.map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.venue}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <span className="text-sm">{event.rating}</span>
                      </div>
                      <p className="text-xs text-emerald-600">${event.payout}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Events</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.payment_history.map(payment => (
                      <tr key={payment.id} className="border-b border-border/30">
                        <td className="p-3 text-sm">{new Date(payment.date).toLocaleDateString()}</td>
                        <td className="p-3 text-sm font-medium text-emerald-600">${payment.amount}</td>
                        <td className="p-3 text-sm">{payment.events} events</td>
                        <td className="p-3">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            {payment.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-pink-500" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(staff.performance_metrics).map(([metric, value]) => (
                <div key={metric}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm capitalize">{metric.replace('_', ' ')}</span>
                    <span className="text-sm font-medium">{value}%</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-pink-500" />
                Documents & Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No documents uploaded yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Upload Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
