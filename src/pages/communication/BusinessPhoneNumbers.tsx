/**
 * Business Phone Numbers Admin Page
 * Manage Twilio phone numbers per business for caller ID
 * ADMIN ONLY - Protected route
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Phone, Plus, Edit, Trash2, CheckCircle, XCircle, Building2, TestTube, ShieldAlert, PhoneForwarded } from 'lucide-react';
import { useCall } from '@/components/communication/CallProvider';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

interface BusinessPhoneNumber {
  id: string;
  business_id: string;
  phone_number: string;
  type: string;
  label: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string;
  businesses: { id: string; name: string } | null;
}

export default function BusinessPhoneNumbers() {
  const navigate = useNavigate();
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();
  const userRole = profileData?.profile?.primary_role || '';
  const isAdmin = ['admin', 'ceo', 'owner', 'va'].includes(userRole);

  // Role guard - redirect non-admins
  if (!profileLoading && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page. Only administrators can manage business phone numbers.
          </AlertDescription>
          <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => navigate('/communication')}
          >
            Return to Communication Hub
          </Button>
        </Alert>
      </div>
    );
  }
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<BusinessPhoneNumber | null>(null);
  const [formData, setFormData] = useState({
    business_id: '',
    phone_number: '',
    type: 'call',
    label: '',
    is_default: false,
    is_active: true
  });

  // Fetch businesses
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses-for-phones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch phone numbers with business names
  const { data: phoneNumbers = [], isLoading } = useQuery({
    queryKey: ['business-phone-numbers-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_phone_numbers')
        .select('*, businesses(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BusinessPhoneNumber[];
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        business_id: data.business_id,
        phone_number: data.phone_number,
        type: data.type,
        label: data.label || null,
        is_default: data.is_default,
        is_active: data.is_active
      };

      // If setting as default, unset other defaults for this business
      if (data.is_default) {
        await supabase
          .from('business_phone_numbers')
          .update({ is_default: false })
          .eq('business_id', data.business_id)
          .eq('is_active', true)
          .in('type', ['call', 'both']);
      }

      if (data.id) {
        const { error } = await supabase
          .from('business_phone_numbers')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_phone_numbers')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-phone-numbers-admin'] });
      toast.success(editingNumber ? 'Phone number updated' : 'Phone number added');
      handleCloseDialog();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save')
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_phone_numbers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-phone-numbers-admin'] });
      toast.success('Phone number deleted');
    },
    onError: () => toast.error('Failed to delete')
  });

  const handleOpenDialog = (number?: BusinessPhoneNumber) => {
    if (number) {
      setEditingNumber(number);
      setFormData({
        business_id: number.business_id,
        phone_number: number.phone_number,
        type: number.type,
        label: number.label || '',
        is_default: number.is_default || false,
        is_active: number.is_active ?? true
      });
    } else {
      setEditingNumber(null);
      setFormData({
        business_id: '',
        phone_number: '',
        type: 'call',
        label: '',
        is_default: false,
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingNumber(null);
  };

  const handleSubmit = () => {
    if (!formData.business_id || !formData.phone_number) {
      toast.error('Business and phone number are required');
      return;
    }
    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(formData.phone_number)) {
      toast.error('Phone number must be in E.164 format (e.g., +17185551234)');
      return;
    }
    saveMutation.mutate(editingNumber ? { ...formData, id: editingNumber.id } : formData);
  };

  const handleTestCall = (number: BusinessPhoneNumber) => {
    initiateCall({
      destinationPhone: '+19999999999', // Placeholder - admin's phone
      businessId: number.business_id,
      entityType: 'other',
      entityName: `Test call from ${number.businesses?.name || 'Unknown'}`
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Phone className="h-6 w-6 text-primary" />
              Business Phone Numbers
            </h1>
            <p className="text-muted-foreground">Configure Twilio numbers per business for caller ID</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" /> Add Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingNumber ? 'Edit Phone Number' : 'Add Phone Number'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Business *</Label>
                  <Select value={formData.business_id} onValueChange={(v) => setFormData({...formData, business_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                    <SelectContent>
                      {businesses.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number (E.164) *</Label>
                  <Input
                    placeholder="+17185551234"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">Must include country code, e.g., +1 for US</p>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call Only</SelectItem>
                      <SelectItem value="sms">SMS Only</SelectItem>
                      <SelectItem value="both">Call & SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Label (Optional)</Label>
                  <Input
                    placeholder="Main Line, Support, etc."
                    value={formData.label}
                    onChange={(e) => setFormData({...formData, label: e.target.value})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Is Default Caller ID</Label>
                  <Switch 
                    checked={formData.is_default} 
                    onCheckedChange={(v) => setFormData({...formData, is_default: v})} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch 
                    checked={formData.is_active} 
                    onCheckedChange={(v) => setFormData({...formData, is_active: v})} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : phoneNumbers.length === 0 ? (
              <div className="p-8 text-center">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No phone numbers configured</p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" /> Add First Number
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers.map((num) => (
                    <TableRow key={num.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {num.businesses?.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{num.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{num.type}</Badge>
                      </TableCell>
                      <TableCell>{num.label || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {num.is_active ? (
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          {num.is_default && (
                            <Badge variant="outline" className="border-primary text-primary">Default</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleTestCall(num)} title="Test Call">
                            <TestTube className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(num)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive" 
                            onClick={() => deleteMutation.mutate(num.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
