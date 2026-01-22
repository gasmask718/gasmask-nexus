/**
 * Ambassador Leads Page
 * Pipelines for store leads, wholesaler leads, influencer recruits, ambassador recruits
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Store, ShoppingCart, Users, UserPlus, Plus, 
  Search, ChevronRight, Clock, CheckCircle, XCircle,
  Phone, Mail, MapPin, Calendar, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';

interface Lead {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  stage: string;
  stage_order: number;
  created_at: string;
  notes?: string;
  next_action?: string;
  next_action_date?: string;
}

interface Pipeline {
  id: string;
  name: string;
  icon: React.ReactNode;
  stages: string[];
  leads: Lead[];
}

export default function AmbassadorLeads() {
  const [searchQuery, setSearchQuery] = useState('');

  // Define pipelines
  const pipelines: Pipeline[] = [
    {
      id: 'stores',
      name: 'Store Leads',
      icon: <Store className="h-4 w-4" />,
      stages: ['New', 'Contacted', 'Meeting Set', 'Proposal', 'Negotiation', 'Won', 'Lost'],
      leads: [
        {
          id: '1',
          name: 'Bronx Grocery Store',
          contact_name: 'Carlos Rodriguez',
          phone: '(555) 111-2222',
          address: '123 Grand Concourse, Bronx, NY',
          stage: 'Contacted',
          stage_order: 1,
          created_at: new Date(Date.now() - 172800000).toISOString(),
          next_action: 'Follow up call',
          next_action_date: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: '2',
          name: 'Harlem Deli',
          contact_name: 'Sarah Johnson',
          phone: '(555) 222-3333',
          address: '456 Malcolm X Blvd, Harlem, NY',
          stage: 'Meeting Set',
          stage_order: 2,
          created_at: new Date(Date.now() - 259200000).toISOString(),
          next_action: 'Site visit',
          next_action_date: new Date(Date.now() + 172800000).toISOString(),
        },
        {
          id: '3',
          name: 'Queens Mini Mart',
          contact_name: 'David Kim',
          phone: '(555) 333-4444',
          address: '789 Queens Blvd, Queens, NY',
          stage: 'Proposal',
          stage_order: 3,
          created_at: new Date(Date.now() - 345600000).toISOString(),
          next_action: 'Send contract',
          next_action_date: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'wholesalers',
      name: 'Wholesaler Leads',
      icon: <ShoppingCart className="h-4 w-4" />,
      stages: ['Identified', 'Reached Out', 'Qualified', 'Onboarding', 'Active'],
      leads: [
        {
          id: '4',
          name: 'Metro Wholesale Supply',
          contact_name: 'Robert Chen',
          phone: '(555) 444-5555',
          email: 'robert@metrowholesale.com',
          stage: 'Reached Out',
          stage_order: 1,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          notes: 'Interested in tobacco products',
        },
      ],
    },
    {
      id: 'influencers',
      name: 'Influencer / Street Team',
      icon: <Users className="h-4 w-4" />,
      stages: ['Identified', 'Contacted', 'Interested', 'Training', 'Active'],
      leads: [
        {
          id: '5',
          name: 'Mike the Promoter',
          phone: '(555) 555-6666',
          email: 'mike@promo.com',
          stage: 'Interested',
          stage_order: 2,
          created_at: new Date(Date.now() - 432000000).toISOString(),
          notes: 'Has 15K followers, good engagement',
        },
      ],
    },
    {
      id: 'ambassadors',
      name: 'Ambassador Recruits',
      icon: <UserPlus className="h-4 w-4" />,
      stages: ['Applied', 'Screening', 'Interview', 'Background Check', 'Onboarding', 'Active'],
      leads: [
        {
          id: '6',
          name: 'Jessica Thompson',
          phone: '(555) 666-7777',
          email: 'jessica.t@email.com',
          stage: 'Interview',
          stage_order: 2,
          created_at: new Date(Date.now() - 518400000).toISOString(),
          next_action: 'Final interview',
          next_action_date: new Date(Date.now() + 259200000).toISOString(),
        },
      ],
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
          <div className="flex items-center justify-between">
            <TabsList>
              {pipelines.map((pipeline) => (
                <TabsTrigger key={pipeline.id} value={pipeline.id} className="gap-2">
                  {pipeline.icon}
                  {pipeline.name}
                  <Badge variant="secondary" className="ml-1">{pipeline.leads.length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <Button>
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
                    const stageLeads = pipeline.leads.filter(l => l.stage === stage);
                    
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

                                {lead.next_action && (
                                  <div className="mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-2 text-xs">
                                      <Calendar className="h-3 w-3 text-primary" />
                                      <span className="text-primary font-medium">{lead.next_action}</span>
                                    </div>
                                    {lead.next_action_date && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {format(new Date(lead.next_action_date), 'MMM d, yyyy')}
                                      </div>
                                    )}
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
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </EnhancedPortalLayout>
  );
}
