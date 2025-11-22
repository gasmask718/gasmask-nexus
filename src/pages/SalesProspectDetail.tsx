import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MessageSquare, CheckCircle, XCircle, Clock, Store } from "lucide-react";
import { format } from "date-fns";

export default function SalesProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [communicationType, setCommunicationType] = useState("call");

  const { data: prospect } = useQuery({
    queryKey: ['sales-prospect', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_prospects')
        .select(`
          *,
          assigned_user:profiles!sales_prospects_assigned_to_fkey(id, name, email)
        `)
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: communications } = useQuery({
    queryKey: ['prospect-communications', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .eq('linked_entity_type', 'prospect')
        .eq('linked_entity_id', id!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from('sales_prospects')
        .update({
          pipeline_stage: newStage,
          last_contacted: newStage !== 'new' ? new Date().toISOString() : prospect?.last_contacted
        })
        .eq('id', id!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-prospect', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-prospects'] });
      toast.success('Stage updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + (error as Error).message);
    }
  });

  const logCommunicationMutation = useMutation({
    mutationFn: async ({ type, summary }: { type: string; summary: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('communication_events')
        .insert([{
          event_type: type,
          summary,
          direction: 'outbound',
          channel: type === 'call' ? 'phone' : type === 'text' ? 'sms' : 'email',
          linked_entity_type: 'prospect',
          linked_entity_id: id,
          user_id: user.user.id
        }]);

      if (error) throw error;

      // Update prospect communication count and last contacted
      const { error: updateError } = await supabase
        .from('sales_prospects')
        .update({
          last_contacted: new Date().toISOString(),
          total_communications: (prospect?.total_communications || 0) + 1
        })
        .eq('id', id!);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-communications', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-prospect', id] });
      setNewNote("");
      toast.success('Communication logged');
    },
    onError: (error) => {
      toast.error('Failed to log: ' + (error as Error).message);
    }
  });

  const convertToStoreMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Create store record
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .insert([{
          name: prospect?.store_name,
          contact_name: prospect?.contact_name,
          phone: prospect?.phone,
          email: prospect?.email,
          address: prospect?.address,
          city: prospect?.city,
          state: prospect?.state,
          zip_code: prospect?.zipcode,
          notes: prospect?.notes,
          status: 'active',
          type: 'bodega'
        }])
        .select()
        .single();

      if (storeError) throw storeError;

      // Update prospect
      const { error: updateError } = await supabase
        .from('sales_prospects')
        .update({
          pipeline_stage: 'activated',
          converted_store_id: store.id
        })
        .eq('id', id!);

      if (updateError) throw updateError;

      return store;
    },
    onSuccess: (store) => {
      toast.success('Converted to store successfully!');
      navigate(`/stores/${store.id}`);
    },
    onError: (error) => {
      toast.error('Failed to convert: ' + (error as Error).message);
    }
  });

  const handleLogCommunication = () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    logCommunicationMutation.mutate({
      type: communicationType,
      summary: newNote
    });
  };

  if (!prospect) return <Layout><div className="p-12 text-center">Loading...</div></Layout>;

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-500',
      'contacted': 'bg-cyan-500',
      'follow-up': 'bg-yellow-500',
      'interested': 'bg-orange-500',
      'qualified': 'bg-green-500',
      'activated': 'bg-emerald-500',
      'closed-lost': 'bg-red-500'
    };
    return colors[stage] || 'bg-gray-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales/prospects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{prospect.store_name}</h1>
            <p className="text-muted-foreground mt-1">
              {prospect.city && prospect.state ? `${prospect.city}, ${prospect.state}` : 'No location'}
            </p>
          </div>
          <Badge className={getStageColor(prospect.pipeline_stage)}>
            {prospect.pipeline_stage}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column - Details */}
          <div className="space-y-6 md:col-span-2">
            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
                <CardDescription>Automated scoring and recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-primary">{prospect.priority || 0}</div>
                    <div className="text-sm text-muted-foreground">Priority Score</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-green-500">{prospect.likelihood_to_activate || 0}%</div>
                    <div className="text-sm text-muted-foreground">Likelihood</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold">{prospect.total_communications || 0}</div>
                    <div className="text-sm text-muted-foreground">Contacts</div>
                  </div>
                </div>

                <div className="p-4 bg-accent/50 rounded-lg">
                  <h4 className="font-semibold mb-2">AI Recommendation:</h4>
                  <p className="text-sm">
                    {prospect.likelihood_to_activate && prospect.likelihood_to_activate > 70
                      ? "🎯 High conversion potential - Push for activation this week"
                      : prospect.priority && prospect.priority > 60
                      ? "📞 Good prospect - Schedule follow-up within 2-3 days"
                      : "🔄 Continue nurturing - Build relationship with regular check-ins"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Log Communication */}
            <Card>
              <CardHeader>
                <CardTitle>Log New Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={communicationType} onValueChange={setCommunicationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">In-Person Meeting</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="What happened in this interaction?"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={handleLogCommunication}
                  disabled={logCommunicationMutation.isPending}
                >
                  {logCommunicationMutation.isPending ? 'Logging...' : 'Log Communication'}
                </Button>
              </CardContent>
            </Card>

            {/* Communication Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Communication Timeline</CardTitle>
                <CardDescription>History of all interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {communications && communications.length > 0 ? (
                  <div className="space-y-4">
                    {communications.map((comm: any) => (
                      <div key={comm.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0 mt-1">
                          {comm.event_type === 'call' ? <Phone className="h-5 w-5" /> :
                           comm.event_type === 'email' ? <Mail className="h-5 w-5" /> :
                           <MessageSquare className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold capitalize">{comm.event_type}</span>
                            <Badge variant="outline">{comm.direction}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm">{comm.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No communications logged yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {prospect.contact_name && (
                  <div>
                    <div className="text-muted-foreground">Contact</div>
                    <div className="font-medium">{prospect.contact_name}</div>
                  </div>
                )}
                {prospect.phone && (
                  <div>
                    <div className="text-muted-foreground">Phone</div>
                    <div className="font-medium">{prospect.phone}</div>
                  </div>
                )}
                {prospect.email && (
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium">{prospect.email}</div>
                  </div>
                )}
                {prospect.address && (
                  <div>
                    <div className="text-muted-foreground">Address</div>
                    <div className="font-medium">{prospect.address}</div>
                  </div>
                )}
                {prospect.source && (
                  <div>
                    <div className="text-muted-foreground">Source</div>
                    <Badge variant="outline">{prospect.source}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stage Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Update Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => updateStageMutation.mutate('contacted')}
                  disabled={updateStageMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Contacted
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => updateStageMutation.mutate('follow-up')}
                  disabled={updateStageMutation.isPending}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Mark as Follow-up
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => updateStageMutation.mutate('interested')}
                  disabled={updateStageMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Interested
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => updateStageMutation.mutate('qualified')}
                  disabled={updateStageMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Qualified
                </Button>
                <Button
                  className="w-full justify-start"
                  onClick={() => convertToStoreMutation.mutate()}
                  disabled={convertToStoreMutation.isPending || prospect.pipeline_stage === 'activated'}
                >
                  <Store className="mr-2 h-4 w-4" />
                  {prospect.pipeline_stage === 'activated' ? 'Already Activated' : 'Convert to Store'}
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="destructive"
                  onClick={() => updateStageMutation.mutate('closed-lost')}
                  disabled={updateStageMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark as Lost
                </Button>
              </CardContent>
            </Card>

            {prospect.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{prospect.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}