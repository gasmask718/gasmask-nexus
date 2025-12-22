import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Phone, Mail, MessageSquare, Edit, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Store {
  id: string;
  name: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  alt_phone: string;
  email: string;
  tags: string[];
}

interface StoreContactInfoCardProps {
  store: Store;
  onUpdate: () => void;
}

export function StoreContactInfoCard({ store, onUpdate }: StoreContactInfoCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone: store.phone || '',
    alt_phone: store.alt_phone || '',
    email: store.email || '',
    address_street: store.address_street || '',
    address_city: store.address_city || '',
    address_state: store.address_state || '',
    address_zip: store.address_zip || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update(formData)
        .eq('id', store.id);

      if (error) throw error;

      toast.success('Contact information updated');
      setEditOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating store:', error);
      toast.error('Failed to update contact information');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Contact Information
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Contact Info
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Address */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Address</p>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p>{store.address_street || 'No street address'}</p>
                <p>{[store.address_city, store.address_state, store.address_zip].filter(Boolean).join(', ') || 'No city/state'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Phone Numbers - Clearly Separated */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Phone Numbers</p>
            
            {/* Store Phone (Call Only) */}
            {store.phone ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <a href={`tel:${store.phone}`} className="text-sm font-medium hover:underline">
                      {store.phone}
                    </a>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Store Telephone
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-500/30">
                        Call Only
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`tel:${store.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No store phone</p>
            )}

            {/* Alt Phone (Cell - Text Enabled) */}
            {store.alt_phone && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <a href={`tel:${store.alt_phone}`} className="text-sm font-medium hover:underline">
                      {store.alt_phone}
                    </a>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Cell Phone
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/30">
                        Text Enabled
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`tel:${store.alt_phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`sms:${store.alt_phone}`}>
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          {store.email && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href={`mailto:${store.email}`} className="text-sm hover:underline">
                  {store.email}
                </a>
              </div>
            </>
          )}

          {/* Tags */}
          {store.tags && store.tags.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {store.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Store Telephone (Call Only)</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Cell Phone (Text Enabled)</Label>
              <Input
                value={formData.alt_phone}
                onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                placeholder="(555) 987-6543"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="store@example.com"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                value={formData.address_street}
                onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  placeholder="NY"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={formData.address_zip}
                onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                placeholder="10001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}