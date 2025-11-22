import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Loader2 } from "lucide-react";

export default function SalesProspects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: prospects, isLoading } = useQuery({
    queryKey: ['sales-prospects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_prospects')
        .select(`
          *,
          assigned_user:profiles!sales_prospects_assigned_to_fkey(id, name)
        `)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const filteredProspects = prospects?.filter(p => {
    const matchesSearch = search === "" || 
      p.store_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStage = stageFilter === "all" || p.pipeline_stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

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

  const getPriorityColor = (priority: number) => {
    if (priority >= 70) return 'text-red-500';
    if (priority >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sales Prospects</h1>
            <p className="text-muted-foreground mt-2">
              Manage your sales pipeline
            </p>
          </div>
          <Button onClick={() => navigate('/sales/prospects/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Prospect
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prospects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="activated">Activated</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Prospects List */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredProspects && filteredProspects.length > 0 ? (
          <div className="space-y-3">
            {filteredProspects.map((prospect: any) => (
              <Card
                key={prospect.id}
                className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/sales/prospects/${prospect.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{prospect.store_name}</h3>
                      <Badge className={getStageColor(prospect.pipeline_stage)}>
                        {prospect.pipeline_stage}
                      </Badge>
                      {prospect.source && (
                        <Badge variant="outline">{prospect.source}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {prospect.contact_name && <div>Contact: {prospect.contact_name}</div>}
                      <div>
                        {prospect.city && prospect.state 
                          ? `${prospect.city}, ${prospect.state}`
                          : prospect.address || 'No location'}
                      </div>
                      {prospect.phone && <div>Phone: {prospect.phone}</div>}
                      {prospect.assigned_user && (
                        <div>Assigned to: {prospect.assigned_user.name}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getPriorityColor(prospect.priority || 0)}`}>
                        {prospect.priority || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Priority</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold">{prospect.likelihood_to_activate || 0}%</div>
                      <div className="text-xs text-muted-foreground">Likelihood</div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold">{prospect.total_communications || 0}</div>
                      <div className="text-xs text-muted-foreground">Contacts</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <h3 className="font-semibold mb-2">No prospects found</h3>
            <p className="text-muted-foreground mb-4">
              {search || stageFilter !== "all" 
                ? "Try adjusting your filters"
                : "Add your first prospect to get started"}
            </p>
            {!search && stageFilter === "all" && (
              <Button onClick={() => navigate('/sales/prospects/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Prospect
              </Button>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}