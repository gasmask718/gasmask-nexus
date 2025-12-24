import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, Bike, Phone, Mail, MapPin, Edit, 
  DollarSign, CheckCircle2, Clock, Calendar, 
  ClipboardCheck, AlertTriangle
} from 'lucide-react';

const BikerProfile: React.FC = () => {
  const { bikerId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch biker details
  const { data: biker, isLoading } = useQuery({
    queryKey: ['biker', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bikers')
        .select('*')
        .eq('id', bikerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bikerId
  });

  // Fetch biker tasks (store checks)
  const { data: tasks = [] } = useQuery({
    queryKey: ['biker-tasks', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_checks')
        .select(`*, location:delivery_locations(*)`)
        .eq('assigned_biker_id', bikerId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bikerId
  });

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ['biker-payouts', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_payouts')
        .select('*')
        .eq('worker_id', bikerId)
        .eq('worker_type', 'biker')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!bikerId
  });

  // Update biker
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('bikers').update(data).eq('id', bikerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker', bikerId] });
      toast.success('Biker updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update biker')
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (!biker) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Biker not found</p>
          <Button className="mt-4" onClick={() => navigate('/delivery/bikers')}>
            Back to Bikers
          </Button>
        </div>
      </Layout>
    );
  }

  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned').length;
  const totalEarnings = payouts.reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/delivery/bikers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bike className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{biker.full_name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {biker.territory && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {biker.territory}
                    </span>
                  )}
                  <Badge variant={biker.status === 'active' ? 'default' : 'secondary'}>
                    {biker.status}
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Biker</DialogTitle>
              </DialogHeader>
              <EditBikerForm 
                biker={biker}
                onSubmit={(data) => updateMutation.mutate(data)}
                isLoading={updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Contact & Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href={`tel:${biker.phone}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{biker.phone}</p>
                </div>
              </a>
              {biker.email && (
                <a href={`mailto:${biker.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{biker.email}</p>
                  </div>
                </a>
              )}
              {biker.payout_method && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payout Method</p>
                    <p className="font-medium">{biker.payout_method} {biker.payout_handle && `(${biker.payout_handle})`}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{completedTasks}</div>
                    <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold">{pendingTasks}</div>
                    <p className="text-sm text-muted-foreground">Pending Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs for Tasks & Payouts */}
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">
              <ClipboardCheck className="h-4 w-4 mr-2" /> Recent Tasks
            </TabsTrigger>
            <TabsTrigger value="payouts">
              <DollarSign className="h-4 w-4 mr-2" /> Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tasks assigned yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map((task: any) => (
                  <Card key={task.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{task.location?.name || 'Unknown Location'}</p>
                            <p className="text-sm text-muted-foreground">
                              {task.task_type} • {format(new Date(task.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                          {task.status}
                        </Badge>
                      </div>
                      {task.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{task.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            {payouts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No payouts yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout: any) => (
                  <Card key={payout.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">${payout.total_to_pay?.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {payout.period_start} to {payout.period_end}
                            </p>
                          </div>
                        </div>
                        <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                          {payout.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/delivery/biker-tasks')}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" /> Assign New Task
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/delivery/payouts')}
          >
            <DollarSign className="h-4 w-4 mr-2" /> View Payouts
          </Button>
        </div>
      </div>
    </Layout>
  );
};

// Edit Form Component
const EditBikerForm: React.FC<{
  biker: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ biker, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    full_name: biker.full_name || '',
    phone: biker.phone || '',
    email: biker.email || '',
    territory: biker.territory || '',
    payout_method: biker.payout_method || '',
    payout_handle: biker.payout_handle || ''
  });

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium">Full Name</label>
        <Input 
          value={formData.full_name}
          onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <Input 
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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
      <div>
        <label className="text-sm font-medium">Territory</label>
        <Input 
          value={formData.territory}
          onChange={(e) => setFormData(prev => ({ ...prev, territory: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Payout Method</label>
          <Input 
            value={formData.payout_method}
            onChange={(e) => setFormData(prev => ({ ...prev, payout_method: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Payout Handle</label>
          <Input 
            value={formData.payout_handle}
            onChange={(e) => setFormData(prev => ({ ...prev, payout_handle: e.target.value }))}
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

export default BikerProfile;
