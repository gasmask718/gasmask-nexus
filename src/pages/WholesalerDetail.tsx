import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Mail, Phone, MapPin, Star, MessageSquare, Package } from "lucide-react";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { CommunicationLogModal } from "@/components/CommunicationLogModal";
import { FollowUpInsights } from "@/components/communication/FollowUpInsights";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { useState } from "react";

export default function WholesalerDetail() {
  const { id } = useParams();
  const [logModalOpen, setLogModalOpen] = useState(false);

  const { data: wholesaler, isLoading } = useQuery({
    queryKey: ['wholesaler', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_hubs')
        .select('*')
        .eq('id', id)
        .single();

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
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-muted-foreground">Loading wholesaler...</div>
        </div>
      </Layout>
    );
  }

  if (!wholesaler) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Wholesaler not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{wholesaler.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={wholesaler.status === 'active' ? 'default' : 'secondary'}>
                {wholesaler.status}
              </Badge>
              {wholesaler.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-medium">{wholesaler.rating}/5</span>
                </div>
              )}
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
            <div className="text-sm text-muted-foreground">Rating</div>
            <div className="text-2xl font-bold">
              {wholesaler.rating ? `${wholesaler.rating}/5` : 'N/A'}
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
            {wholesaler.address_street && (
              <div className="flex items-start gap-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div>{wholesaler.address_street}</div>
                  <div>
                    {wholesaler.address_city}, {wholesaler.address_state} {wholesaler.address_zip}
                  </div>
                </div>
              </div>
            )}
          </div>
          {wholesaler.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">{wholesaler.notes}</p>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="communication" className="space-y-6">
          <TabsList>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="communication" className="space-y-6">
              <CommunicationStats entityType="wholesaler" entityId={id!} />
              <AIRelationshipHealth entityType="wholesaler" entityId={id!} />
              <FollowUpInsights entityType="wholesaler" entityId={id!} />
            <CommunicationTimeline entityType="wholesaler" entityId={id!} />
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
    </Layout>
  );
}
