/**
 * TopTier Deal Detail Page
 * Full view of a deal/booking with all related data
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Edit, Calendar, DollarSign, Building2, 
  User, MapPin, Clock, CheckCircle, AlertCircle,
  Percent, Mail, Phone, FileText
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierDealDetail() {
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedBookings = getEntityData('booking');
  const simulatedPartners = getEntityData('partner');
  const { data: bookings, isSimulated } = useResolvedData([], simulatedBookings);
  const { data: partners } = useResolvedData([], simulatedPartners);

  const deal = useMemo(() => {
    return bookings.find((b: any) => b.id === dealId);
  }, [bookings, dealId]);

  const linkedPartners = useMemo(() => {
    if (!deal?.linked_partners) return [];
    return partners.filter((p: any) => deal.linked_partners.includes(p.id));
  }, [deal, partners]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'upcoming':
        return <Badge className="bg-blue-500/10 text-blue-500"><Calendar className="h-3 w-3 mr-1" />Upcoming</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!deal) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Deal not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The deal you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/crm/toptier-experience/bookings')}>
            View All Bookings
          </Button>
        </Card>
      </div>
    );
  }

  const commission = Math.round((deal.total_amount || 0) * 10 / 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{deal.booking_name || `Booking #${deal.id?.slice(0,8)}`}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(deal.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Created {format(new Date(deal.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/deals/${dealId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Deal
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Deal Value */}
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-3xl font-bold">${(deal.total_amount || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission</p>
                <p className="text-3xl font-bold">${commission.toLocaleString()}</p>
              </div>
              <Percent className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Event Date</p>
                <p className="text-2xl font-bold">
                  {deal.event_date ? format(new Date(deal.event_date), 'MMM d, yyyy') : 'TBD'}
                </p>
              </div>
              <Calendar className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer Name</p>
              <p className="font-medium">{deal.customer_name}</p>
            </div>
            {deal.customer_email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${deal.customer_email}`} className="text-primary hover:underline">
                  {deal.customer_email}
                </a>
              </div>
            )}
            {deal.customer_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${deal.customer_phone}`} className="text-primary hover:underline">
                  {deal.customer_phone}
                </a>
              </div>
            )}
            {deal.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{deal.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Partners */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Linked Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedPartners.length === 0 ? (
              <p className="text-muted-foreground text-sm">No partners linked to this deal.</p>
            ) : (
              <div className="space-y-3">
                {linkedPartners.map((partner: any) => (
                  <div 
                    key={partner.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{partner.company_name}</p>
                        <p className="text-sm text-muted-foreground">{partner.city}, {partner.state}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{partner.commission_rate}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Categories & Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Deal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {deal.partner_categories?.map((cat: string) => (
                <Badge key={cat} variant="secondary">{cat.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-2">Notes</p>
            <p className="text-sm">{deal.notes || 'No notes added.'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
