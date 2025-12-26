/**
 * Partner Overview Tab - Full page view with edit capability
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Edit, ExternalLink, Phone, Mail, MapPin, 
  DollarSign, Percent, Calendar, Building2,
  User, Link2, CheckCircle, AlertCircle, Clock,
  TrendingUp, Eye
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerOverviewTabProps {
  partner: any;
  isSimulated: boolean;
  bookings: any[];
  campaigns: any[];
}

export default function PartnerOverviewTab({ partner, isSimulated, bookings, campaigns }: PartnerOverviewTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  
  const categoryInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === partner?.partner_category);
  
  const getStateName = (code: string) => {
    return US_STATES.find(s => s.value === code)?.label || code;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'expired':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate KPIs
  const totalDeals = bookings.length;
  const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
  const totalCommission = Math.round(totalRevenue * (partner?.commission_rate || 10) / 100);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Overview
          {isSimulated && <SimulationBadge />}
        </h2>
        <Button onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Overview
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-3xl font-bold">{totalDeals}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-4 w-full"
              onClick={() => navigate(`/crm/toptier-experience/analytics/deals`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold">${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-4 w-full"
              onClick={() => navigate(`/crm/toptier-experience/analytics/revenue`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commission</p>
                <p className="text-3xl font-bold">${totalCommission.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Percent className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-4 w-full"
              onClick={() => navigate(`/crm/toptier-experience/analytics/commissions`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Partner Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Partner Details</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/edit`)}>
              <Edit className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{categoryInfo?.label}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contract Status</p>
                <div className="mt-1">{getStatusBadge(partner.contract_status)}</div>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Service Area</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{getStateName(partner.state)} (Primary)</Badge>
                {partner.service_area?.filter((s: string) => s !== partner.state).map((state: string) => (
                  <Badge key={state} variant="outline">{getStateName(state)}</Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">City</p>
                <p className="font-medium">{partner.city}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Availability</p>
                <p className="font-medium text-sm">{partner.availability_rules || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Commission */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pricing & Commission</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/edit`)}>
              <Edit className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Pricing Range</p>
                <p className="text-xl font-bold">{partner.pricing_range || 'Not set'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10">
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-xl font-bold text-green-600">{partner.commission_rate}%</p>
              </div>
              <Percent className="h-8 w-8 text-green-500" />
            </div>
            {partner.booking_link && (
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-2">Booking / Affiliate Link</p>
                <a 
                  href={partner.booking_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Link2 className="h-3 w-3" />
                  {partner.booking_link}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Contact Information</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/toptier-experience/contacts`)}>
            <Eye className="h-4 w-4 mr-2" />
            View All Contacts
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Primary Contact</p>
                <p className="font-medium">{partner.contact_name || 'Not specified'}</p>
              </div>
            </div>
            {partner.phone && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <a href={`tel:${partner.phone}`} className="font-medium text-primary hover:underline">
                    {partner.phone}
                  </a>
                </div>
              </div>
            )}
            {partner.email && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${partner.email}`} className="font-medium text-primary hover:underline">
                    {partner.email}
                  </a>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Bookings</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/deals`)}>
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bookings yet</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => navigate(`/crm/toptier-experience/deals/new?partnerId=${partnerId}`)}
              >
                Create Deal
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.slice(0, 5).map((booking: any) => (
                <div 
                  key={booking.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/crm/toptier-experience/deals/${booking.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.event_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">${(booking.total_amount || 0).toLocaleString()}</p>
                    <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
