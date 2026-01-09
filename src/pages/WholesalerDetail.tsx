import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Mail, Phone, MapPin, Star, MessageSquare, Package, Headphones, ArrowLeft } from "lucide-react";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { FollowUpInsights } from "@/components/communication/FollowUpInsights";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { useState } from "react";

export default function WholesalerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logModalOpen, setLogModalOpen] = useState(false);

  const { data: wholesaler, isLoading } = useQuery({
    queryKey: ['wholesaler', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesalers')
        .select(`
          *,
          company:companies(
            id,
            name,
            default_billing_address,
            default_city,
            default_state,
            default_phone,
            default_email,
            notes
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ['wholesaler-products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_products')
        .select('*, brands(name, color)')
        .eq('wholesaler_id', id)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted-foreground">Loading wholesaler...</div>
      </div>
    );
  }

  if (!wholesaler) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Wholesaler not found</h2>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold">{wholesaler.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={wholesaler.status === 'active' ? 'default' : 'secondary'}>
                {wholesaler.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLogModalOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Log Communication
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Products</div>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Contact</div>
            <div className="text-sm font-medium">
              {wholesaler.contact_name || 'N/A'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Status</div>
            <Badge variant={wholesaler.status === 'active' ? 'default' : 'secondary'}>
              {wholesaler.status}
            </Badge>
          </Card>
        </div>

        {/* Contact & Location */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Contact & Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {wholesaler.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{wholesaler.email}</span>
              </div>
            )}
            {wholesaler.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{wholesaler.phone}</span>
              </div>
            )}
            {(wholesaler.company?.default_billing_address || wholesaler.company?.default_city) && (
              <div className="flex items-start gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {wholesaler.company?.default_billing_address && (
                    <div>{wholesaler.company.default_billing_address}</div>
                  )}
                  {(wholesaler.company?.default_city || wholesaler.company?.default_state) && (
                    <div>
                      {wholesaler.company?.default_city}
                      {wholesaler.company?.default_city && wholesaler.company?.default_state && ', '}
                      {wholesaler.company?.default_state}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {wholesaler.company?.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">{wholesaler.company.notes}</p>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="communication" className="space-y-6">
          <TabsList>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="calls">
              <Headphones className="h-4 w-4 mr-2" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="communication" className="space-y-6">
              <CommunicationStats entityType="wholesaler" entityId={id!} />
              <AIRelationshipHealth entityType="wholesaler" entityId={id!} />
              <FollowUpInsights entityType="wholesaler" entityId={id!} />
            <CommunicationTimeline entityType="wholesaler" entityId={id!} />
          </TabsContent>

          <TabsContent value="calls" className="space-y-6">
            <Card className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Headphones className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>Call recordings and intelligence will appear here when calls are made to this wholesaler.</p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products?.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold line-clamp-1">{product.name}</h4>
                      {product.brands && (
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: product.brands.color || undefined }}
                          className="mt-1"
                        >
                          {product.brands.name}
                        </Badge>
                      )}
                      <div className="mt-2 text-sm text-muted-foreground">
                        ${product.price.toFixed(2)} • Case of {product.case_size}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {products?.length === 0 && (
                <Card className="p-8 text-center md:col-span-3">
                  <p className="text-muted-foreground">No products listed</p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Order history coming soon
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CommunicationLogModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        entityType="wholesaler"
        entityId={id!}
        entityName={wholesaler.name}
        onSuccess={() => setLogModalOpen(false)}
      />
    </div>
  );
}
