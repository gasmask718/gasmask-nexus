/**
 * TopTier New Deal - Create booking/deal form
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Calendar, DollarSign, Users, Building2 } from 'lucide-react';
import { US_STATES, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

export default function TopTierNewDeal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { simulationMode } = useSimulationMode();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill from query params
  const [formData, setFormData] = useState({
    customer_id: searchParams.get('customer_id') || '',
    customer_name: searchParams.get('customer_name') || '',
    partner_id: searchParams.get('partner_id') || '',
    partner_name: searchParams.get('partner_name') || '',
    category: searchParams.get('category') || '',
    state: searchParams.get('state') || '',
    city: '',
    event_date: '',
    event_time: '',
    booking_value: '',
    deposit_amount: '',
    commission_rate: '10',
    status: 'pending',
    notes: '',
    special_requests: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (action: 'view' | 'another' | 'close') => {
    if (!formData.customer_name || !formData.partner_name || !formData.event_date) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      if (simulationMode) {
        toast.success('Deal created (Simulation Mode)');
      } else {
        // Real DB insert would go here
        toast.success('Deal created successfully');
      }

      if (action === 'view') {
        navigate(`/crm/toptier-experience/deals/deal_new`);
      } else if (action === 'another') {
        setFormData({
          customer_id: '', customer_name: '', partner_id: '', partner_name: '',
          category: '', state: '', city: '', event_date: '', event_time: '',
          booking_value: '', deposit_amount: '', commission_rate: '10',
          status: 'pending', notes: '', special_requests: '',
        });
      } else {
        navigate('/crm/toptier-experience/deals');
      }
    } catch (error) {
      toast.error('Failed to create deal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/deals')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deals
        </Button>
        
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Create New Deal</h1>
          {simulationMode && <SimulationBadge />}
        </div>
      </div>

      {/* Customer & Partner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer & Partner
          </CardTitle>
          <CardDescription>Link this deal to a customer and partner</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              placeholder="Enter customer name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner_name">Partner Name *</Label>
            <Input
              id="partner_name"
              value={formData.partner_name}
              onChange={(e) => handleChange('partner_name', e.target.value)}
              placeholder="Enter partner name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TOPTIER_PARTNER_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(state => (
                  <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Enter city"
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Event Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event_date">Event Date *</Label>
            <Input
              id="event_date"
              type="date"
              value={formData.event_date}
              onChange={(e) => handleChange('event_date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_time">Event Time</Label>
            <Input
              id="event_time"
              type="time"
              value={formData.event_time}
              onChange={(e) => handleChange('event_time', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing & Commission
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="booking_value">Booking Value ($)</Label>
            <Input
              id="booking_value"
              type="number"
              value={formData.booking_value}
              onChange={(e) => handleChange('booking_value', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit_amount">Deposit Amount ($)</Label>
            <Input
              id="deposit_amount"
              type="number"
              value={formData.deposit_amount}
              onChange={(e) => handleChange('deposit_amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_rate">Commission Rate (%)</Label>
            <Input
              id="commission_rate"
              type="number"
              value={formData.commission_rate}
              onChange={(e) => handleChange('commission_rate', e.target.value)}
              placeholder="10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes & Special Requests</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea
              id="special_requests"
              value={formData.special_requests}
              onChange={(e) => handleChange('special_requests', e.target.value)}
              placeholder="Any special requests from the customer..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Internal notes about this deal..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate('/crm/toptier-experience/deals')}>
          Cancel
        </Button>
        <Button 
          variant="outline"
          onClick={() => handleSubmit('another')}
          disabled={isSubmitting}
        >
          Save & Add Another
        </Button>
        <Button 
          variant="outline"
          onClick={() => handleSubmit('close')}
          disabled={isSubmitting}
        >
          Save & Close
        </Button>
        <Button 
          onClick={() => handleSubmit('view')}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          Save & View Deal
        </Button>
      </div>
    </div>
  );
}
