/**
 * UnforgettableStaffProfile
 * 
 * SYSTEM LAW: Profiles represent people, not layouts.
 * A profile without an ID is a bug.
 * Tabs are views into data, not decorations.
 * If a tab doesn't query by staff ID, it is broken.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Phone, Mail, Calendar, DollarSign, Star, Clock, 
  MapPin, FileText, Edit, 
  Award, TrendingUp, AlertCircle, User, Briefcase, Loader2
} from "lucide-react";
import { useStaffMember } from '@/hooks/useUnforgettableStaff';
import StaffEventsTab from '@/components/staff/tabs/StaffEventsTab';
import StaffPaymentsTab from '@/components/staff/tabs/StaffPaymentsTab';
import StaffPerformanceTab from '@/components/staff/tabs/StaffPerformanceTab';
import StaffDocumentsTab from '@/components/staff/tabs/StaffDocumentsTab';

export default function UnforgettableStaffProfile() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch real staff data by ID - this is the core fix
  const { data: staff, isLoading, error } = useStaffMember(staffId);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen p-6 space-y-6">
        <Button variant="ghost" disabled className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff
        </Button>
        <Card className="border-border/50 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-pink-600 to-purple-500" />
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-6 -mt-12">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 pt-4 md:pt-8 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !staff) {
    return (
      <div className="min-h-screen p-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/os/unforgettable/staff')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff
        </Button>
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
            <p className="text-muted-foreground mb-6">
              {staffId 
                ? `No staff member found with ID: ${staffId}`
                : 'No staff ID provided in the URL'}
            </p>
            <Button 
              onClick={() => navigate('/os/unforgettable/staff')}
              className="bg-gradient-to-r from-pink-600 to-purple-500"
            >
              Return to Staff Directory
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'inactive': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      'pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'on_leave': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'terminated': 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return statusMap[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'active': 'Active',
      'inactive': 'Inactive',
      'pending': 'Pending',
      'on_leave': 'On Leave',
      'terminated': 'Terminated',
    };
    return labels[status] || status;
  };

  // Build full address
  const fullAddress = [
    staff.address_line_1,
    staff.address_line_2,
    staff.city && staff.state ? `${staff.city}, ${staff.state}` : staff.city || staff.state,
    staff.zip
  ].filter(Boolean).join(', ') || 'No address on file';

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
                {staff.first_name?.[0]}{staff.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 pt-4 md:pt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{staff.first_name} {staff.last_name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {staff.category?.name || 'Uncategorized'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={getStatusBadge(staff.status || 'active')}>
                      {getStatusLabel(staff.status || 'active')}
                    </Badge>
                    {staff.category && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                        {staff.category.name}
                      </Badge>
                    )}
                    {staff.pay_type && (
                      <Badge variant="secondary">
                        {staff.pay_type === 'hourly' ? 'Hourly' : 'Per Event'}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {staff.phone && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`tel:${staff.phone}`)}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  )}
                  {staff.email && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`mailto:${staff.email}`)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/os/unforgettable/staff/${staffId}/notes`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Notes
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/os/unforgettable/staff/${staffId}/venues`)}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Venues
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-pink-600 to-purple-500" 
                    size="sm"
                    onClick={() => navigate(`/os/unforgettable/staff/${staffId}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
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
            <p className="text-2xl font-bold">{staff.events_completed ?? 0}</p>
            <p className="text-xs text-muted-foreground">Events Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.rating?.toFixed(1) ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">
              ${(staff.total_earnings ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Earnings</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {staff.pay_rate ? `$${staff.pay_rate}` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">
              {staff.pay_type === 'hourly' ? 'Hourly Rate' : 'Event Rate'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {staff.hire_date 
                ? Math.floor((Date.now() - new Date(staff.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Months Employed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 text-rose-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{staff.preferred_contact_method || '-'}</p>
            <p className="text-xs text-muted-foreground">Contact Pref.</p>
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
                  <span className="text-sm">{staff.email || 'No email on file'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{staff.phone || 'No phone on file'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{fullAddress}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Emergency Contact</p>
                    <p className="text-sm">
                      {staff.emergency_contact_name 
                        ? `${staff.emergency_contact_name}${staff.emergency_contact_phone ? ` - ${staff.emergency_contact_phone}` : ''}`
                        : 'No emergency contact on file'}
                    </p>
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
                  <span className="text-sm text-muted-foreground">Category</span>
                  <span className="text-sm font-medium">{staff.category?.name || 'Uncategorized'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">{getStatusLabel(staff.status || 'active')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pay Type</span>
                  <span className="text-sm font-medium">
                    {staff.pay_type === 'hourly' ? 'Hourly' : staff.pay_type === 'per_event' ? 'Per Event' : staff.pay_type || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pay Rate</span>
                  <span className="text-sm font-medium">
                    {staff.pay_rate ? `$${staff.pay_rate}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Hire Date</span>
                  <span className="text-sm font-medium">
                    {staff.hire_date ? new Date(staff.hire_date).toLocaleDateString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date of Birth</span>
                  <span className="text-sm font-medium">
                    {staff.dob ? new Date(staff.dob).toLocaleDateString() : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Availability Notes */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-pink-500" />
                  Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {staff.availability_notes || 'No availability notes recorded'}
                </p>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-pink-500" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {staff.notes || 'No notes recorded'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Events Tab - Real data driven by staff_id */}
        <TabsContent value="events" className="space-y-4">
          <StaffEventsTab staffId={staffId!} />
        </TabsContent>

        {/* Payments Tab - Real data driven by staff_id */}
        <TabsContent value="payments" className="space-y-4">
          <StaffPaymentsTab 
            staffId={staffId!} 
            payRate={staff.pay_rate} 
            payType={staff.pay_type} 
          />
        </TabsContent>

        {/* Performance Tab - Computed from real data */}
        <TabsContent value="performance" className="space-y-4">
          <StaffPerformanceTab 
            staffId={staffId!}
            rating={staff.rating}
            eventsCompleted={staff.events_completed}
            totalEarnings={staff.total_earnings}
          />
        </TabsContent>

        {/* Documents Tab - Staff-scoped documents */}
        <TabsContent value="documents" className="space-y-4">
          <StaffDocumentsTab staffId={staffId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
