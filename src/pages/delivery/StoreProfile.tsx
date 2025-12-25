import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { 
  ArrowLeft, Store, MapPin, Phone, Clock, 
  ClipboardCheck, AlertTriangle, Bike, Calendar,
  TrendingUp, Package, DollarSign, UserPlus
} from 'lucide-react';
import { BikerAssignmentDialog } from '@/components/biker';

const StoreProfile: React.FC = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  // Fetch store/location details
  const { data: store, isLoading } = useQuery({
    queryKey: ['store-profile', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', storeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId
  });

  // Fetch store checks for this location
  const { data: storeChecks = [] } = useQuery({
    queryKey: ['store-checks-location', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_checks')
        .select(`
          *,
          biker:bikers(id, full_name)
        `)
        .eq('location_id', storeId)
        .order('scheduled_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Loading store...</div>
      </Layout>
    );
  }

  if (!store) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Store not found</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  const recentChecks = storeChecks.slice(0, 5);
  const completedChecks = storeChecks.filter((c: any) => c.status === 'approved').length;
  const issuesCount = storeChecks.filter((c: any) => c.status === 'rejected').length;

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{store.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{store.address_line1}, {store.city}</span>
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowAssignDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign Biker
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-emerald-500" />
                <div>
                  <div className="text-2xl font-bold">{storeChecks.length}</div>
                  <p className="text-sm text-muted-foreground">Total Checks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{completedChecks}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-bold">{issuesCount}</div>
                  <p className="text-sm text-muted-foreground">Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {storeChecks[0] ? format(new Date(storeChecks[0].scheduled_date), 'MMM d') : '-'}
                  </div>
                  <p className="text-sm text-muted-foreground">Last Check</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Store Info */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{store.address_line1}</p>
                <p className="text-sm">{store.city}, {store.state} {store.zip}</p>
              </div>
              {store.contact_phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <a href={`tel:${store.contact_phone}`} className="font-medium text-primary flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {store.contact_phone}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline" className="capitalize">
                  {store.location_type || 'Store'}
                </Badge>
              </div>
              {store.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{store.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check History */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Check History</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/delivery/biker-tasks')}>
                Schedule Check
              </Button>
            </CardHeader>
            <CardContent>
              {recentChecks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No checks recorded yet</p>
                  <Button className="mt-4" onClick={() => setShowAssignDialog(true)}>
                    Assign First Check
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChecks.map((check: any) => (
                    <div 
                      key={check.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          check.status === 'approved' ? 'bg-emerald-500' :
                          check.status === 'rejected' ? 'bg-red-500' :
                          check.status === 'submitted' ? 'bg-blue-500' :
                          'bg-amber-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{check.check_type.replace('_', ' ')}</span>
                            <Badge variant="outline" className="capitalize">
                              {check.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{format(new Date(check.scheduled_date), 'MMM d, yyyy')}</span>
                            {check.biker && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Bike className="h-3 w-3" />
                                  {check.biker.full_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {check.summary_notes && (
                        <p className="text-sm text-muted-foreground max-w-xs truncate">
                          {check.summary_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setShowAssignDialog(true)}
          >
            <Bike className="h-4 w-4 mr-2" />
            Assign Biker
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/delivery/biker-tasks')}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Schedule Check
          </Button>
        </div>

        {/* Assignment Dialog */}
        <BikerAssignmentDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          entityType="store"
          entityId={storeId}
          entityName={store.name}
        />
      </div>
    </Layout>
  );
};

export default StoreProfile;
