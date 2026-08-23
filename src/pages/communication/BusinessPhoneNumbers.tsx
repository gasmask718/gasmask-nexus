/**
 * Business Phone Numbers & Inbound Routing Admin Page
 * Manage Twilio phone numbers per business for caller ID
 * Configure inbound call routing rules
 * ADMIN ONLY - Protected route
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Phone, Plus, Edit, Trash2, Building2, TestTube, ShieldAlert, 
  PhoneForwarded, PhoneIncoming, User, Users, Voicemail, CheckCircle 
} from 'lucide-react';
import { useCall } from '@/components/communication/CallProvider';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { InboundHumansFirstTab } from '@/components/communication/InboundHumansFirstTab';

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

interface InboundRoute {
  id: string;
  business_id: string;
  phone_number_id: string | null;
  route_type: 'user' | 'role' | 'voicemail';
  route_target_user_id: string | null;
  route_target_role: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  businesses?: { id: string; name: string } | null;
  business_phone_numbers?: { id: string; phone_number: string; label: string | null } | null;
  user_profiles?: { full_name: string | null } | null;
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PhoneForwarded className="h-6 w-6 text-primary" />
          Caller IDs & Routing
        </h1>
        <p className="text-muted-foreground">Configure outbound caller IDs and inbound call routing per business</p>
      </div>

      <Tabs defaultValue="caller-ids" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="caller-ids" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Caller IDs
          </TabsTrigger>
          <TabsTrigger value="inbound-routing" className="flex items-center gap-2">
            <PhoneIncoming className="h-4 w-4" />
            Inbound Routing
          </TabsTrigger>
          <TabsTrigger value="humans-first" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Humans First
          </TabsTrigger>
        </TabsList>

        <TabsContent value="caller-ids">
          <CallerIDsTab />
        </TabsContent>

        <TabsContent value="inbound-routing">
          <InboundRoutingTab />
        </TabsContent>

        <TabsContent value="humans-first">
          <InboundHumansFirstTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==========================================
// CALLER IDs TAB
// ==========================================
function CallerIDsTab() {
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
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(formData.phone_number)) {
      toast.error('Phone number must be in E.164 format (e.g., +17185551234)');
      return;
    }
    saveMutation.mutate(editingNumber ? { ...formData, id: editingNumber.id } : formData);
  };

  const handleTestCall = (number: BusinessPhoneNumber) => {
    initiateCall({
      destinationPhone: '+19999999999',
      businessId: number.business_id,
      entityType: 'other',
      entityName: `Test call from ${number.businesses?.name || 'Unknown'}`
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          These phone numbers are used as Caller ID when placing outbound calls.
        </p>
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
  );
}

// ==========================================
// INBOUND ROUTING TAB
// ==========================================
function InboundRoutingTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<InboundRoute | null>(null);
  const [formData, setFormData] = useState({
    business_id: '',
    phone_number_id: '',
    route_type: 'voicemail' as 'user' | 'role' | 'voicemail',
    route_target_user_id: '',
    route_target_role: '',
    is_default: false,
    is_active: true
  });

  // Fetch businesses
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses-for-routes'],
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

  // Fetch phone numbers for dropdown
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['phone-numbers-for-routes', formData.business_id],
    queryFn: async () => {
      if (!formData.business_id) return [];
      const { data, error } = await supabase
        .from('business_phone_numbers')
        .select('id, phone_number, label')
        .eq('business_id', formData.business_id)
        .eq('is_active', true)
        .in('type', ['call', 'both']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.business_id
  });

  // Fetch ALL users to show phone status
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, primary_role, phone')
        .order('full_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Users with valid phones only (for User route dropdown)
  const usersWithPhone = allUsers.filter((u: any) => u.phone && u.phone.trim() !== '');

  // Get count of users per role with valid phone
  const roleUserCounts = useMemo(() => {
    const counts: Record<string, { total: number; withPhone: number }> = {};
    const AVAILABLE_ROLES = ['owner', 'admin', 'va', 'staff', 'csr', 'ambassador'];
    AVAILABLE_ROLES.forEach(role => {
      const roleUsers = allUsers.filter((u: any) => u.primary_role === role);
      counts[role] = {
        total: roleUsers.length,
        withPhone: roleUsers.filter((u: any) => u.phone && u.phone.trim() !== '').length
      };
    });
    return counts;
  }, [allUsers]);

  // Fetch inbound routes
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['inbound-call-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inbound_call_routes')
        .select(`
          *,
          businesses(id, name),
          business_phone_numbers(id, phone_number, label)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch user names for routes with user targets
      const routesWithUsers = await Promise.all((data || []).map(async (route: any) => {
        if (route.route_target_user_id) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('full_name, phone')
            .eq('user_id', route.route_target_user_id)
            .single();
          return { ...route, user_profiles: userProfile };
        }
        return route;
      }));
      
      return routesWithUsers as InboundRoute[];
    }
  });

  // Check if current form selection will work
  const routeValidation = useMemo(() => {
    if (formData.route_type === 'user') {
      const selectedUser = allUsers.find((u: any) => u.user_id === formData.route_target_user_id);
      if (selectedUser && (!selectedUser.phone || selectedUser.phone.trim() === '')) {
        return { valid: false, message: `${selectedUser.full_name || 'Selected user'} has no phone number configured. Calls cannot ring.` };
      }
    }
    if (formData.route_type === 'role' && formData.route_target_role) {
      const counts = roleUserCounts[formData.route_target_role];
      if (counts && counts.withPhone === 0) {
        return { 
          valid: false, 
          message: `No users with role '${formData.route_target_role}' have a phone number. ${counts.total} user(s) exist but none can receive calls.` 
        };
      }
    }
    return { valid: true, message: null };
  }, [formData.route_type, formData.route_target_user_id, formData.route_target_role, allUsers, roleUserCounts]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        business_id: data.business_id,
        phone_number_id: data.phone_number_id || null,
        route_type: data.route_type,
        route_target_user_id: data.route_type === 'user' ? data.route_target_user_id : null,
        route_target_role: data.route_type === 'role' ? data.route_target_role : null,
        is_default: data.is_default,
        is_active: data.is_active
      };

      if (data.id) {
        const { error } = await supabase
          .from('inbound_call_routes')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inbound_call_routes')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-call-routes'] });
      toast.success(editingRoute ? 'Route updated' : 'Route created');
      handleCloseDialog();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save')
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inbound_call_routes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-call-routes'] });
      toast.success('Route deleted');
    },
    onError: () => toast.error('Failed to delete')
  });

  const handleOpenDialog = (route?: InboundRoute) => {
    if (route) {
      setEditingRoute(route);
      setFormData({
        business_id: route.business_id,
        phone_number_id: route.phone_number_id || '',
        route_type: route.route_type,
        route_target_user_id: route.route_target_user_id || '',
        route_target_role: route.route_target_role || '',
        is_default: route.is_default,
        is_active: route.is_active
      });
    } else {
      setEditingRoute(null);
      setFormData({
        business_id: '',
        phone_number_id: '',
        route_type: 'voicemail',
        route_target_user_id: '',
        route_target_role: '',
        is_default: false,
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoute(null);
  };

  const handleSubmit = () => {
    if (!formData.business_id) {
      toast.error('Business is required');
      return;
    }
    if (formData.route_type === 'user' && !formData.route_target_user_id) {
      toast.error('Please select a user to route calls to');
      return;
    }
    if (formData.route_type === 'role' && !formData.route_target_role) {
      toast.error('Please select a role to route calls to');
      return;
    }
    
    // Warn but allow saving if no callable users
    if (!routeValidation.valid) {
      toast.warning(`Warning: ${routeValidation.message}`);
    }
    
    saveMutation.mutate(editingRoute ? { ...formData, id: editingRoute.id } : formData);
  };

  const getRouteTypeIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />;
      case 'role': return <Users className="h-4 w-4" />;
      case 'voicemail': return <Voicemail className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRouteTarget = (route: InboundRoute) => {
    switch (route.route_type) {
      case 'user':
        const userProfile = route.user_profiles as any;
        const hasPhone = userProfile?.phone && userProfile.phone.trim() !== '';
        return (
          <span className={!hasPhone ? 'text-destructive' : ''}>
            {userProfile?.full_name || 'Unknown User'}
            {!hasPhone && ' ⚠️ No Phone'}
          </span>
        );
      case 'role':
        const counts = roleUserCounts[route.route_target_role || ''];
        const roleHasPhone = counts && counts.withPhone > 0;
        return (
          <span className={!roleHasPhone ? 'text-destructive' : ''}>
            {route.route_target_role} ({counts?.withPhone || 0} callable)
            {!roleHasPhone && ' ⚠️'}
          </span>
        );
      case 'voicemail':
        return 'Voicemail';
      default:
        return 'Unknown';
    }
  };

  const AVAILABLE_ROLES = ['owner', 'admin', 'va', 'staff', 'csr', 'ambassador'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Define how inbound calls to each business number are routed.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRoute ? 'Edit Inbound Route' : 'Add Inbound Route'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Business *</Label>
                <Select 
                  value={formData.business_id} 
                  onValueChange={(v) => setFormData({...formData, business_id: v, phone_number_id: ''})}
                >
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
                <Label>Phone Number (Optional)</Label>
                <Select 
                  value={formData.phone_number_id || "__all__"} 
                  onValueChange={(v) => setFormData({...formData, phone_number_id: v === "__all__" ? "" : v})}
                  disabled={!formData.business_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All business numbers (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All business numbers (default)</SelectItem>
                    {phoneNumbers.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.phone_number} {p.label ? `(${p.label})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave empty to create a default route for all business numbers
                </p>
              </div>

              <div className="space-y-2">
                <Label>Route Type *</Label>
                <Select 
                  value={formData.route_type} 
                  onValueChange={(v) => setFormData({...formData, route_type: v as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Specific User
                      </div>
                    </SelectItem>
                    <SelectItem value="role">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Role (First Available)
                      </div>
                    </SelectItem>
                    <SelectItem value="voicemail">
                      <div className="flex items-center gap-2">
                        <Voicemail className="h-4 w-4" /> Voicemail
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.route_type === 'user' && (
                <div className="space-y-2">
                  <Label>Target User *</Label>
                  <Select 
                    value={formData.route_target_user_id} 
                    onValueChange={(v) => setFormData({...formData, route_target_user_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {usersWithPhone.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No users with phone numbers configured
                        </div>
                      ) : (
                        usersWithPhone.map((u: any) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name || 'Unknown'} ({u.primary_role}) - {u.phone}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {usersWithPhone.length === 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertDescription>
                        No users have phone numbers. Add phone numbers to user profiles before creating user routes.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {formData.route_type === 'role' && (
                <div className="space-y-2">
                  <Label>Target Role *</Label>
                  <Select 
                    value={formData.route_target_role} 
                    onValueChange={(v) => setFormData({...formData, route_target_role: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ROLES.map((role) => {
                        const counts = roleUserCounts[role];
                        const hasCallable = counts && counts.withPhone > 0;
                        return (
                          <SelectItem key={role} value={role} className="capitalize">
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{role}</span>
                              <Badge 
                                variant={hasCallable ? 'default' : 'destructive'} 
                                className="text-xs ml-2"
                              >
                                {counts?.withPhone || 0}/{counts?.total || 0} callable
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Calls will ring the first available user with this role who has a phone number
                  </p>
                  
                  {/* Show validation warning */}
                  {!routeValidation.valid && formData.route_target_role && (
                    <Alert variant="destructive" className="mt-2">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertDescription>{routeValidation.message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Is Default Route</Label>
                  <p className="text-xs text-muted-foreground">Used when no phone-specific route exists</p>
                </div>
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : routes.length === 0 ? (
            <div className="p-8 text-center">
              <PhoneIncoming className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No inbound routes configured</p>
              <p className="text-sm text-muted-foreground mb-4">
                Incoming calls will fall back to the "Dynasty OS Kiosk" voicemail
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" /> Add First Route
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Route Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {route.businesses?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {route.business_phone_numbers?.phone_number || (
                        <span className="text-muted-foreground italic">All numbers</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRouteTypeIcon(route.route_type)}
                        <span className="capitalize">{route.route_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getRouteTarget(route)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {route.is_active ? (
                          <Badge variant="default" className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {route.is_default && (
                          <Badge variant="outline" className="border-primary text-primary">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(route)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive" 
                          onClick={() => deleteMutation.mutate(route.id)}
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

      {/* Verification Summary */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Routing Verification
          </h3>
          <div className="space-y-2 text-sm">
            {businesses.map((business: any) => {
              const businessRoutes = routes.filter(r => r.business_id === business.id && r.is_active);
              const hasDefault = businessRoutes.some(r => r.is_default);
              return (
                <div key={business.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span>{business.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={businessRoutes.length > 0 ? 'default' : 'destructive'}>
                      {businessRoutes.length} route(s)
                    </Badge>
                    {hasDefault ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">Has Default</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">No Default</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}