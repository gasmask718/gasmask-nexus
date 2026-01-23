/**
 * Ambassador Leads Page
 * Real data from useAmbassadorLeads hook - pipelines for store/wholesaler/influencer/ambassador leads
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Store, ShoppingCart, Users, UserPlus, Plus, 
  Search, ChevronRight, Clock, CheckCircle, XCircle,
  Phone, Mail, MapPin, Calendar, ArrowRight, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { useAmbassadorLeads, type Lead } from '@/hooks/useAmbassadorLeads';
import { toast } from 'sonner';

export default function AmbassadorLeads() {
  const [searchQuery, setSearchQuery] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [selectedLeadType, setSelectedLeadType] = useState<string>('store');
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Real data from hook
  const { 
    storeLeads, wholesalerLeads, influencerLeads, ambassadorLeads,
    getLeadsByStage, storeStages, wholesalerStages, influencerStages, ambassadorStages,
    isLoading, createLead, isCreatingLead, updateStage, convertLead, isConvertingLead
  } = useAmbassadorLeads();

  // Form state for new lead
  const [newLead, setNewLead] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    notes: '',
  });

  const handleCreateLead = async () => {
    if (!newLead.name.trim()) {
      toast.error('Please enter a business/contact name');
      return;
    }
    
    try {
      await createLead({
        ...newLead,
        lead_type: selectedLeadType,
        source: `${selectedLeadType}_referral`,
      });
      setAddLeadOpen(false);
      setNewLead({ name: '', contact_name: '', phone: '', email: '', address: '', city: '', state: '', notes: '' });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleMoveStage = async (lead: Lead, newStage: string) => {
    try {
      await updateStage({ leadId: lead.id, newStage });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    try {
      await convertLead({ leadId: lead.id, lead });
      setLeadDetailOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
  };

  // Define pipelines with real data
  const pipelines = [
    {
      id: 'stores',
      name: 'Store Leads',
      icon: <Store className="h-4 w-4" />,
      stages: storeStages,
      leads: storeLeads,
    },
    {
      id: 'wholesalers',
      name: 'Wholesaler Leads',
      icon: <ShoppingCart className="h-4 w-4" />,
      stages: wholesalerStages,
      leads: wholesalerLeads,
    },
    {
      id: 'influencers',
      name: 'Influencer / Street Team',
      icon: <Users className="h-4 w-4" />,
      stages: influencerStages,
      leads: influencerLeads,
    },
    {
      id: 'ambassadors',
      name: 'Ambassador Recruits',
      icon: <UserPlus className="h-4 w-4" />,
      stages: ambassadorStages,
      leads: ambassadorLeads,
    },
  ];

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'New': 'bg-gray-500',
      'Identified': 'bg-gray-500',
      'Applied': 'bg-gray-500',
      'Contacted': 'bg-blue-500',
      'Reached Out': 'bg-blue-500',
      'Screening': 'bg-blue-500',
      'Meeting Set': 'bg-purple-500',
      'Qualified': 'bg-purple-500',
      'Interested': 'bg-purple-500',
      'Interview': 'bg-purple-500',
      'Proposal': 'bg-yellow-500',
      'Onboarding': 'bg-yellow-500',
      'Training': 'bg-yellow-500',
      'Background Check': 'bg-yellow-500',
      'Negotiation': 'bg-orange-500',
      'Won': 'bg-green-500',
      'Active': 'bg-green-500',
      'Lost': 'bg-red-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <EnhancedPortalLayout 
        title="Leads Pipeline" 
        subtitle="Manage prospects across all channels"
        backPath="/ambassador/dashboard"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </EnhancedPortalLayout>
    );
  }

  return (
    <EnhancedPortalLayout 
      title="Leads Pipeline" 
      subtitle="Manage prospects across all channels"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    {pipeline.icon}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{pipeline.name}</p>
                    <p className="text-2xl font-bold">{pipeline.leads.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline Tabs */}
        <Tabs defaultValue="stores" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList className="flex-wrap h-auto">
              {pipelines.map((pipeline) => (
                <TabsTrigger key={pipeline.id} value={pipeline.id} className="gap-2">
                  {pipeline.icon}
                  <span className="hidden sm:inline">{pipeline.name}</span>
                  <Badge variant="secondary" className="ml-1">{pipeline.leads.length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <Button onClick={() => setAddLeadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>

          {pipelines.map((pipeline) => (
            <TabsContent key={pipeline.id} value={pipeline.id} className="space-y-4">
              {/* Search */}
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Search ${pipeline.name.toLowerCase()}...`}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Kanban-style Stage View */}
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {pipeline.stages.map((stage) => {
                    const stageLeads = pipeline.leads.filter(l => 
                      l.stage === stage && 
                      (searchQuery === '' || l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    );
                    
                    return (
                      <div 
                        key={stage}
                        className="w-[300px] flex-shrink-0"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStageColor(stage)}`} />
                            <span className="font-medium">{stage}</span>
                          </div>
                          <Badge variant="secondary">{stageLeads.length}</Badge>
                        </div>
                        
                        <div className="space-y-3">
                          {stageLeads.map((lead) => (
                            <Card 
                              key={lead.id}
                              className="cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => openLeadDetail(lead)}
                            >
                              <CardContent className="p-4">
                                <div className="font-medium mb-2">{lead.name}</div>
                                
                                {lead.contact_name && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Users className="h-3 w-3" />
                                    {lead.contact_name}
                                  </div>
                                )}
                                
                                {lead.phone && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </div>
                                )}
                                
                                {lead.address && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{lead.address}</span>
                                  </div>
                                )}

                                {lead.next_follow_up && (
                                  <div className="mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-2 text-xs">
                                      <Calendar className="h-3 w-3 text-primary" />
                                      <span className="text-primary font-medium">Follow up</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(lead.next_follow_up), 'MMM d, yyyy')}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                  <span className="text-xs text-muted-foreground">
                                    Added {format(new Date(lead.created_at), 'MMM d')}
                                  </span>
                                  <Button variant="ghost" size="sm" className="h-7 px-2">
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          
                          {stageLeads.length === 0 && (
                            <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                              <p className="text-sm">No leads in this stage</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Empty state for pipeline */}
              {pipeline.leads.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                    {pipeline.icon}
                  </div>
                  <h3 className="font-medium mb-2">No {pipeline.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building your pipeline by adding leads
                  </p>
                  <Button onClick={() => {
                    setSelectedLeadType(pipeline.id.replace('s', '').replace('influencer', 'influencer').replace('ambassador', 'ambassador'));
                    setAddLeadOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add {pipeline.name.replace(' Leads', '')}
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Enter details for the new prospect
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lead Type</Label>
              <Select value={selectedLeadType} onValueChange={setSelectedLeadType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="influencer">Influencer / Street Team</SelectItem>
                  <SelectItem value="ambassador">Ambassador Recruit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Business / Contact Name *</Label>
              <Input 
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                placeholder="e.g. Quick Stop Deli"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input 
                  value={newLead.contact_name}
                  onChange={(e) => setNewLead({ ...newLead, contact_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input 
                value={newLead.address}
                onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input 
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input 
                  value={newLead.state}
                  onChange={(e) => setNewLead({ ...newLead, state: e.target.value })}
                  placeholder="NY"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLead} disabled={isCreatingLead}>
              {isCreatingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Modal */}
      <Dialog open={leadDetailOpen} onOpenChange={setLeadDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Lead details and actions
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={getStageColor(selectedLead.stage)}>{selectedLead.stage}</Badge>
                <Badge variant="outline">{selectedLead.lead_type}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedLead.contact_name && (
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium">{selectedLead.contact_name}</p>
                  </div>
                )}
                {selectedLead.phone && (
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                )}
                {selectedLead.email && (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedLead.email}</p>
                  </div>
                )}
                {selectedLead.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedLead.address}{selectedLead.city ? `, ${selectedLead.city}` : ''}{selectedLead.state ? `, ${selectedLead.state}` : ''}</p>
                  </div>
                )}
              </div>

              {selectedLead.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedLead.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium">Move to Stage</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedLead.lead_type === 'store' ? storeStages :
                    selectedLead.lead_type === 'wholesaler' ? wholesalerStages :
                    selectedLead.lead_type === 'influencer' ? influencerStages : ambassadorStages
                  ).map(stage => (
                    <Button
                      key={stage}
                      variant={selectedLead.stage === stage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleMoveStage(selectedLead, stage)}
                    >
                      {stage}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedLead.lead_type === 'store' && selectedLead.stage !== 'Won' && selectedLead.stage !== 'Lost' && (
                <div className="pt-4 border-t">
                  <Button 
                    className="w-full" 
                    onClick={() => handleConvertLead(selectedLead)}
                    disabled={isConvertingLead}
                  >
                    {isConvertingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Convert to Store & Assign
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    This will create a store record and assign it to you
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </EnhancedPortalLayout>
  );
}
