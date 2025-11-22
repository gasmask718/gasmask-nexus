import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Phone, Mail, Star, Building2 } from "lucide-react";
import { toast } from "sonner";

interface WholesaleHub {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_city: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  notes: string | null;
  products_available: string[] | null;
  status: string | null;
}

export default function Wholesale() {
  const [hubs, setHubs] = useState<WholesaleHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address_street: "",
    address_city: "",
    rating: 3,
    notes: "",
    products_available: "",
  });

  useEffect(() => {
    loadHubs();
  }, []);

  const loadHubs = async () => {
    try {
      const { data, error } = await supabase
        .from('wholesale_hubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHubs(data || []);
    } catch (error) {
      console.error('Error loading hubs:', error);
      toast.error('Failed to load wholesale hubs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const products = formData.products_available
        .split(',')
        .map(p => p.trim())
        .filter(p => p);

      const { error } = await supabase
        .from('wholesale_hubs')
        .insert({
          ...formData,
          products_available: products,
        });

      if (error) throw error;

      toast.success('Wholesale hub added successfully');
      setIsDialogOpen(false);
      setFormData({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address_street: "",
        address_city: "",
        rating: 3,
        notes: "",
        products_available: "",
      });
      loadHubs();
    } catch (error) {
      console.error('Error adding hub:', error);
      toast.error('Failed to add wholesale hub');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading wholesale hubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Wholesale Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and track wholesale distributor relationships
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Hub
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Wholesale Hub</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hub Name *</label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contact Name</label>
                    <Input
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={formData.address_city}
                      onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rating (1-5)</label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Products Available (comma-separated)</label>
                  <Input
                    value={formData.products_available}
                    onChange={(e) => setFormData({ ...formData, products_available: e.target.value })}
                    placeholder="e.g., Cigarettes, Cigars, Vapes"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Add Wholesale Hub
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hubs.map((hub) => (
            <Card key={hub.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold">{hub.name}</h3>
                  {hub.contact_name && (
                    <p className="text-sm text-muted-foreground">{hub.contact_name}</p>
                  )}
                </div>
                {hub.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="text-sm font-medium">{hub.rating}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {hub.address_street && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{hub.address_street}, {hub.address_city}</span>
                  </div>
                )}
                {hub.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{hub.phone}</span>
                  </div>
                )}
                {hub.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{hub.email}</span>
                  </div>
                )}
              </div>

              {hub.products_available && hub.products_available.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">PRODUCTS</p>
                  <div className="flex flex-wrap gap-1">
                    {hub.products_available.map((product, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {product}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {hub.notes && (
                <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                  {hub.notes}
                </p>
              )}

              <Badge 
                variant={hub.status === 'active' ? 'default' : 'outline'} 
                className="mt-3"
              >
                {hub.status}
              </Badge>
            </Card>
          ))}
        </div>

        {hubs.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Wholesale Hubs Yet</h3>
            <p className="text-muted-foreground mb-6">
              Start building your wholesale network by adding your first hub.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Hub
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
