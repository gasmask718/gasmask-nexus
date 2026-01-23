import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, Warehouse, Phone, Mail, MapPin, Edit, 
  Instagram, MessageCircle, Tag, Building2, Globe,
  AlertTriangle, StickyNote, DollarSign
} from 'lucide-react';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { useCall } from '@/components/communication/CallProvider';

const WholesalerProfile: React.FC = () => {
  const { wholesalerId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch wholesaler details
  const { data: wholesaler, isLoading } = useQuery({
    queryKey: ['wholesaler', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesalers')
        .select('*')
        .eq('id', wholesalerId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!wholesalerId
  });

  // Update wholesaler
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('wholesalers').update(data).eq('id', wholesalerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler', wholesalerId] });
      toast.success('Wholesaler updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update wholesaler')
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (!wholesaler) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Wholesaler not found</p>
        <Button className="mt-4" onClick={() => navigate('/grabba/store-master')}>
          Back to CRM
        </Button>
      </div>
    );
  }

  const wholesalerName = wholesaler.name || 'Unknown Wholesaler';
  const territory = wholesaler.neighborhood || '';
  const tags = wholesaler.tags ? (typeof wholesaler.tags === 'string' ? wholesaler.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : wholesaler.tags) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grabba/store-master')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Warehouse className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{wholesalerName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                {territory && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {territory}
                  </span>
                )}
                <Badge variant={wholesaler.status === 'active' ? 'default' : 'secondary'}>
                  {wholesaler.status || 'Active'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Wholesaler</DialogTitle>
            </DialogHeader>
            <EditWholesalerForm 
              wholesaler={wholesaler}
              onSubmit={(data) => updateMutation.mutate(data)}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Warehouse className="h-4 w-4 mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4 mr-2" /> Notes
          </TabsTrigger>
          <TabsTrigger value="orders">
            <DollarSign className="h-4 w-4 mr-2" /> Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {wholesaler.phone && (
                  <button 
                    onClick={() => initiateCall({
                      destinationPhone: wholesaler.phone,
                      entityType: 'wholesaler',
                      entityId: wholesaler.id,
                      entityName: wholesaler.name
                    })}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                  >
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{wholesaler.phone}</p>
                    </div>
                  </button>
                )}
                {wholesaler.phone_secondary && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Secondary Phone</p>
                      <p className="font-medium">{wholesaler.phone_secondary}</p>
                    </div>
                  </div>
                )}
                {wholesaler.phone_whatsapp && (
                  <a href={`https://wa.me/${wholesaler.phone_whatsapp}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{wholesaler.phone_whatsapp}</p>
                    </div>
                  </a>
                )}
                {wholesaler.email && (
                  <a href={`mailto:${wholesaler.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{wholesaler.email}</p>
                    </div>
                  </a>
                )}
                {wholesaler.social_media && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Instagram className="h-5 w-5 text-pink-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Social Media</p>
                      <p className="font-medium">{wholesaler.social_media}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location & Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Location & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {wholesaler.neighborhood && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Neighborhood</p>
                      <p className="font-medium">{wholesaler.neighborhood}</p>
                    </div>
                  </div>
                )}
                {(wholesaler.city || wholesaler.state) && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">City / State</p>
                      <p className="font-medium">
                        {[wholesaler.city, wholesaler.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="p-3">
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 text-sm text-muted-foreground">
                  <p>Created: {format(new Date(wholesaler.created_at), 'MMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EntityNotesSection
            entityType="wholesaler"
            entityId={wholesalerId}
            entityName={wholesalerName}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Order history coming soon
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Edit Form Component
const EditWholesalerForm: React.FC<{
  wholesaler: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ wholesaler, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: wholesaler.name || '',
    phone: wholesaler.phone || '',
    phone_secondary: wholesaler.phone_secondary || '',
    phone_whatsapp: wholesaler.phone_whatsapp || '',
    email: wholesaler.email || '',
    neighborhood: wholesaler.neighborhood || '',
    city: wholesaler.city || '',
    state: wholesaler.state || '',
    social_media: wholesaler.social_media || '',
  });

  return (
    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input 
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Phone</label>
          <Input 
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Secondary Phone</label>
          <Input 
            value={formData.phone_secondary}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_secondary: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">WhatsApp</label>
          <Input 
            value={formData.phone_whatsapp}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_whatsapp: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input 
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Social Media</label>
        <Input 
          value={formData.social_media}
          onChange={(e) => setFormData(prev => ({ ...prev, social_media: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Neighborhood</label>
        <Input 
          value={formData.neighborhood}
          onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">City</label>
          <Input 
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">State</label>
          <Input 
            value={formData.state}
            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
          />
        </div>
      </div>
      <Button 
        className="w-full" 
        onClick={() => onSubmit(formData)}
        disabled={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};

export default WholesalerProfile;
