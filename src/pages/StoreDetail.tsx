import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GeocodingService } from '@/services/geocoding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorePerformanceTab } from '@/components/store/StorePerformanceTab';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import VisitLogModal from '@/components/VisitLogModal';
import { InventoryPredictionCard } from '@/components/map/InventoryPredictionCard';
import { CommunicationTimeline } from '@/components/CommunicationTimeline';
import { CommunicationTimelineCRM } from '@/components/crm/CommunicationTimelineCRM';
import { CommunicationLogModal } from '@/components/CommunicationLogModal';
import { CommunicationStats } from "@/components/communication/CommunicationStats";
import { FollowUpAIRecommendation } from "@/components/store/FollowUpAIRecommendation";
import { ReplenishmentAI } from "@/components/store/ReplenishmentAI";
import { AIRelationshipHealth } from "@/components/communication/AIRelationshipHealth";
import { RouteIntelligence } from "@/components/store/RouteIntelligence";
import { Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, 
  Phone, 
  Mail, 
  ArrowLeft, 
  Package, 
  Clock,
  User,
  FileText,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Calendar,
  Navigation,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { BulkCommunicationLogModal } from '@/components/communication/BulkCommunicationLogModal';

interface Store {
  id: string;
  name: string;
  type: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  alt_phone: string;
  email: string;
  status: string;
  responsiveness: string;
  sticker_status: string;
  notes: string;
  tags: string[];
  primary_contact_name: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  last_visit_date: string | null;
  last_visit_driver_id: string | null;
  visit_frequency_target: number | null;
  visit_risk_level: string | null;
  pipeline_stage?: string;
  ai_recommendation?: string;
}

interface ProductInventory {
  id: string;
  product: {
    name: string;
    brand: {
      name: string;
      color: string;
    };
  };
  last_inventory_level: string;
  last_inventory_check_at: string;
  next_estimated_reorder_date: string;
  urgency_score: number;
  velocity_boxes_per_day: number;
  predicted_stockout_date: string;
}

interface VisitLog {
  id: string;
  visit_type: string;
  visit_datetime: string;
  cash_collected: number;
  payment_method: string;
  customer_response: string;
  user: {
    name: string;
  };
}

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<ProductInventory[]>([]);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [communicationModalOpen, setCommunicationModalOpen] = useState(false);
  const [bulkCommModalOpen, setBulkCommModalOpen] = useState(false);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [geocoding, setGeocoding] = useState(false);

  const { data: routeInsight } = useQuery({
    queryKey: ['route-insight', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('route_insights')
        .select('*')
        .eq('store_id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!id) return;

      try {
        // Fetch store details
        const { data: storeData, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('id', id)
          .single();

        if (storeError) throw storeError;
        setStore(storeData);

        await fetchInventoryAndVisits();
      } catch (error) {
        console.error('Error fetching store data:', error);
        toast.error('Failed to load store details');
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [id]);

  const handleGeocodeAddress = async () => {
    if (!store) return;
    
    setGeocoding(true);
    try {
      const result = await GeocodingService.geocodeAddress(
        store.address_street,
        store.address_city,
        store.address_state,
        store.address_zip
      );

      if ('error' in result) {
        toast.error(`Geocoding failed: ${result.error}`);
        return;
      }

      // Update store with new coordinates
      const { error } = await supabase
        .from('stores')
        .update({ lat: result.lat, lng: result.lng })
        .eq('id', store.id);

      if (error) throw error;

      setStore({ ...store, lat: result.lat as any, lng: result.lng as any });
      toast.success('Address geocoded successfully! Location updated on map.');
    } catch (error) {
      console.error('Error geocoding:', error);
      toast.error('Failed to geocode address');
    } finally {
      setGeocoding(false);
    }
  };

  const fetchInventoryAndVisits = async () => {
    if (!id) return;

    try {
      // Fetch inventory state
      const { data: inventoryData } = await supabase
        .from('store_product_state')
        .select(`
          id,
          last_inventory_level,
          last_inventory_check_at,
          next_estimated_reorder_date,
          urgency_score,
          velocity_boxes_per_day,
          predicted_stockout_date,
          product:products(
            name,
            brand:brands(name, color)
          )
        `)
        .eq('store_id', id);

      setInventory(inventoryData as any || []);

      // Fetch visit logs
      const { data: visitsData } = await supabase
        .from('visit_logs')
        .select(`
          id,
          visit_type,
          visit_datetime,
          cash_collected,
          payment_method,
          customer_response,
          user:profiles(name)
        `)
        .eq('store_id', id)
        .order('visit_datetime', { ascending: false })
        .limit(10);

      setVisits(visitsData as any || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Store not found</p>
          <Button onClick={() => navigate('/stores')}>Back to Stores</Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'prospect': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'needsFollowUp': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getInventoryLevel = (level: string) => {
    switch (level) {
      case 'full': return { value: 100, color: 'bg-green-500', label: 'Full' };
      case 'threeQuarters': return { value: 75, color: 'bg-blue-500', label: '75%' };
      case 'half': return { value: 50, color: 'bg-yellow-500', label: '50%' };
      case 'quarter': return { value: 25, color: 'bg-orange-500', label: '25%' };
      case 'empty': return { value: 0, color: 'bg-red-500', label: 'Empty' };
      default: return { value: 0, color: 'bg-gray-500', label: 'Unknown' };
    }
  };

  const formatVisitType = (type: string) => {
    return type.replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/stores')}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold tracking-tight">{store.name}</h2>
                <Badge className={getStatusColor(store.status)}>
                  {store.status}
                </Badge>
              </div>
              <p className="text-muted-foreground capitalize">
                {store.type.replace('_', ' ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="border-border/50"
                onClick={handleGeocodeAddress}
                disabled={geocoding || !store.address_street}
              >
                <Navigation className="h-4 w-4 mr-2" />
                {geocoding ? 'Geocoding...' : 'Geocode Address'}
              </Button>
              <Button variant="outline" className="border-border/50">
                <FileText className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              <Button 
                className="bg-primary hover:bg-primary-hover"
                onClick={() => setVisitModalOpen(true)}
              >
                Log Visit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <VisitLogModal
        open={visitModalOpen}
        onOpenChange={setVisitModalOpen}
        storeId={id || ''}
        storeName={store.name}
        onSuccess={fetchInventoryAndVisits}
      />

      <CommunicationLogModal
        open={communicationModalOpen}
        onOpenChange={setCommunicationModalOpen}
        entityType="store"
        entityId={id || ''}
        entityName={store.name}
        onSuccess={() => setTimelineRefresh(prev => prev + 1)}
      />

      <BulkCommunicationLogModal
        open={bulkCommModalOpen}
        onOpenChange={setBulkCommModalOpen}
        onSuccess={() => setTimelineRefresh(prev => prev + 1)}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p>{store.address_street}</p>
                      <p>{store.address_city}, {store.address_state} {store.address_zip}</p>
                    </div>
                  </div>
                </div>
                {store.primary_contact_name && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Primary Contact</p>
                    <p className="text-sm font-medium">{store.primary_contact_name}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                {store.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <a href={`tel:${store.phone}`} className="text-sm hover:underline">
                      {store.phone}
                    </a>
                  </div>
                )}
                {store.alt_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${store.alt_phone}`} className="text-sm hover:underline text-muted-foreground">
                      {store.alt_phone} (alt)
                    </a>
                  </div>
                )}
                {store.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <a href={`mailto:${store.email}`} className="text-sm hover:underline">
                      {store.email}
                    </a>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {store.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Communication Stats & AI */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-card border-border/50">
              <CardContent className="pt-6">
                <CommunicationStats entityType="store" entityId={id || ''} />
              </CardContent>
            </Card>
            
            <FollowUpAIRecommendation 
              storeId={id || ''} 
            />
          </div>

          {/* AI Relationship Health */}
          <AIRelationshipHealth entityType="store" entityId={id || ''} />

          {/* Route Intelligence */}
          <RouteIntelligence storeId={id || ''} />

          {/* Replenishment AI */}
          <ReplenishmentAI storeId={id || ''} />

          {/* Route Intelligence Insights */}
          {routeInsight && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Route Intelligence Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Service Time</p>
                    <p className="text-2xl font-bold">
                      {routeInsight.average_service_time_minutes} min
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">
                      {routeInsight.visit_success_rate?.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Difficulty Score</span>
                    <Badge variant={
                      (routeInsight as any).difficulty_score === 1 ? 'default' :
                      (routeInsight as any).difficulty_score === 5 ? 'destructive' :
                      'secondary'
                    }>
                      {(routeInsight as any).difficulty_score}/5
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Best Time</span>
                    <Badge variant="outline" className="capitalize">
                      {routeInsight.best_time_window}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Route Group</span>
                    <Badge variant="outline" className="capitalize">
                      {(routeInsight as any).recommended_route_group}
                    </Badge>
                  </div>
                </div>

                {routeInsight.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{routeInsight.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Communication Timeline */}
          <Card className="glass-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Communication Timeline
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBulkCommModalOpen(true)}
                  className="border-border/50 gap-2"
                >
                  <Users className="h-4 w-4" />
                  Bulk Log
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCommunicationModalOpen(true)}
                  className="border-border/50"
                >
                  Log Communication
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CommunicationTimelineCRM storeId={id || ''} />
            </CardContent>
          </Card>

          {/* Tabs for Inventory & History */}
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="inventory">
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="performance">
                <TrendingUp className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="route-coverage">
                <MapPin className="h-4 w-4 mr-2" />
                Coverage
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="h-4 w-4 mr-2" />
                Visit History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              {/* AI Prediction Card */}
              {inventory.length > 0 && inventory.some(i => i.urgency_score > 0) && (
                <InventoryPredictionCard
                  storeName={store.name}
                  urgencyScore={Math.max(...inventory.map(i => i.urgency_score || 0))}
                  predictedStockoutDate={inventory.find(i => i.predicted_stockout_date)?.predicted_stockout_date || null}
                  velocity={inventory.reduce((sum, i) => sum + (i.velocity_boxes_per_day || 0), 0) / inventory.length}
                />
              )}
              
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Product Inventory Levels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {inventory.length > 0 ? (
                    inventory.map(item => {
                      const level = getInventoryLevel(item.last_inventory_level);
                      return (
                        <div key={item.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: item.product.brand.color }}
                              />
                              <span className="text-sm font-medium">
                                {item.product.brand.name} - {item.product.name}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {level.label}
                            </Badge>
                          </div>
                          <Progress value={level.value} className={`h-2 ${level.color}`} />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Last checked: {item.last_inventory_check_at 
                                ? new Date(item.last_inventory_check_at).toLocaleDateString()
                                : 'Never'}
                            </span>
                            {item.next_estimated_reorder_date && (
                              <span>
                                Next reorder: {new Date(item.next_estimated_reorder_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No inventory data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <StorePerformanceTab storeId={id!} storeName={store.name} />
            </TabsContent>

            <TabsContent value="route-coverage">
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Route & Coverage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {store.last_visit_date ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Visit</p>
                        <p className="font-semibold">
                          {new Date(store.last_visit_date).toLocaleDateString()}
                          {' '}({Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))} days ago)
                        </p>
                      </div>
                      {store.last_visit_driver_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">Last Visit Driver</p>
                          <p className="font-semibold">Driver #{store.last_visit_driver_id.slice(0, 8)}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Visit</p>
                      <p className="font-semibold text-orange-600">Never visited</p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground">Coverage Status</p>
                    <div className="mt-2">
                      {store.visit_risk_level === 'critical' && (
                        <Badge variant="destructive" className="text-base">Critical - Needs Immediate Visit</Badge>
                      )}
                      {store.visit_risk_level === 'at_risk' && (
                        <Badge className="bg-orange-500 text-base">At Risk - Schedule Visit Soon</Badge>
                      )}
                      {(!store.visit_risk_level || store.visit_risk_level === 'normal') && (
                        <Badge variant="secondary" className="text-base">Normal - On Schedule</Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground">Visit Frequency Target</p>
                    <p className="font-semibold">Every {store.visit_frequency_target || 7} days</p>
                  </div>

                  {(store.visit_risk_level === 'critical' || store.visit_risk_level === 'at_risk') && (
                    <>
                      <Separator />
                      <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          Action Required
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          This store has not been visited recently and should be prioritized for the next route.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle>Recent Visits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {visits.length > 0 ? (
                    visits.map(visit => (
                      <div key={visit.id} className="p-4 rounded-lg bg-secondary/30 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {formatVisitType(visit.visit_type)}
                            </Badge>
                            <p className="text-sm text-muted-foreground">
                              by {visit.user.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {new Date(visit.visit_datetime).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(visit.visit_datetime).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        {visit.cash_collected && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-green-500">
                              ${visit.cash_collected.toFixed(2)}
                            </span>
                            {visit.payment_method && (
                              <span className="text-muted-foreground">
                                via {visit.payment_method}
                              </span>
                            )}
                          </div>
                        )}
                        {visit.customer_response && (
                          <p className="text-sm text-muted-foreground italic">
                            "{visit.customer_response}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No visit history available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Quick Stats & Actions */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-2xl font-bold">{visits.length}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Responsiveness</p>
                <Badge variant="outline" className="capitalize">
                  {store.responsiveness}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Sticker Status</p>
                <Badge variant="outline" className="capitalize">
                  {store.sticker_status.replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Member Since</p>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {new Date(store.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {store.notes && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {store.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Update Inventory
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Phone className="h-4 w-4 mr-2" />
                Call Store
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <MapPin className="h-4 w-4 mr-2" />
                Add to Route
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StoreDetail;
