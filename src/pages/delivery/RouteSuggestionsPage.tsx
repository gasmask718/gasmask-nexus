import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Route, Plus, Eye, CheckCircle, XCircle, Clock, 
  MapPin, AlertTriangle, UserPlus, Sparkles, Loader2
} from 'lucide-react';
import { 
  useRouteSuggestions, 
  useGenerateRouteSuggestion,
  useApplyRouteSuggestion,
  useDismissRouteSuggestion,
  RouteSuggestion
} from '@/hooks/useRouteSuggestions';
import { useBoroList } from '@/hooks/useTerritoryStats';
import { format } from 'date-fns';
import { BikerAssignmentDialog } from '@/components/biker/BikerAssignmentDialog';
import { toast } from 'sonner';

const RouteSuggestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateBoro, setGenerateBoro] = useState('');
  const [generatePriority, setGeneratePriority] = useState('sla_risk');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RouteSuggestion | null>(null);

  const { data: boros = [] } = useBoroList();
  const { data: suggestions = [], isLoading } = useRouteSuggestions({
    status: statusFilter || undefined
  });
  const generateRoute = useGenerateRouteSuggestion();
  const applyRoute = useApplyRouteSuggestion();
  const dismissRoute = useDismissRouteSuggestion();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return { variant: 'secondary' as const, icon: Clock };
      case 'reviewed': return { variant: 'outline' as const, icon: Eye };
      case 'approved': return { variant: 'default' as const, icon: CheckCircle };
      case 'applied': return { variant: 'default' as const, icon: CheckCircle };
      case 'dismissed': return { variant: 'destructive' as const, icon: XCircle };
      default: return { variant: 'secondary' as const, icon: Clock };
    }
  };

  const handleGenerate = () => {
    generateRoute.mutate({
      date: today,
      boro: generateBoro || undefined,
      priorityFocus: generatePriority
    }, {
      onSuccess: () => {
        setGenerateDialogOpen(false);
        setGenerateBoro('');
      }
    });
  };

  const handleApply = (suggestion: RouteSuggestion) => {
    setSelectedSuggestion(suggestion);
    setAssignDialogOpen(true);
  };

  const handleBikerAssigned = (bikerId?: string) => {
    if (selectedSuggestion && bikerId) {
      applyRoute.mutate({ 
        suggestionId: selectedSuggestion.id, 
        bikerId 
      });
    }
    setSelectedSuggestion(null);
  };

  const handleDismiss = (suggestionId: string) => {
    dismissRoute.mutate(suggestionId);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-500" />
              Auto-Route Suggestions
            </h1>
            <p className="text-muted-foreground">AI-generated route suggestions based on SLA risk and priorities</p>
          </div>
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-500">
                <Plus className="h-4 w-4 mr-2" />
                Generate Suggestion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Route Suggestion</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Borough (optional)</label>
                  <Select value={generateBoro} onValueChange={setGenerateBoro}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Boroughs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Boroughs</SelectItem>
                      {boros.map(boro => (
                        <SelectItem key={boro} value={boro}>{boro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority Focus</label>
                  <Select value={generatePriority} onValueChange={setGeneratePriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sla_risk">SLA Risk (Due Soon)</SelectItem>
                      <SelectItem value="critical_issues">Critical Issues</SelectItem>
                      <SelectItem value="coverage_gaps">Coverage Gaps</SelectItem>
                      <SelectItem value="followups">Follow-ups Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleGenerate}
                  disabled={generateRoute.isPending}
                >
                  {generateRoute.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex gap-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate('/delivery/heatmap')}>
              <MapPin className="h-4 w-4 mr-2" />
              View Heatmap
            </Button>
          </CardContent>
        </Card>

        {/* Suggestions List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading suggestions...
              </CardContent>
            </Card>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No route suggestions yet</p>
                <Button onClick={() => setGenerateDialogOpen(true)}>
                  Generate Your First Suggestion
                </Button>
              </CardContent>
            </Card>
          ) : (
            suggestions.map((suggestion) => {
              const status = getStatusBadge(suggestion.status);
              const StatusIcon = status.icon;
              
              return (
                <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Route className="h-5 w-5 text-purple-500" />
                        {suggestion.summary || `Route for ${suggestion.date}`}
                      </CardTitle>
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {suggestion.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {suggestion.stops_count} stops
                      </span>
                      <span>
                        Date: {format(new Date(suggestion.date), 'MMM d, yyyy')}
                      </span>
                      {suggestion.boro_filter && (
                        <span>Borough: {suggestion.boro_filter}</span>
                      )}
                      {suggestion.priority_focus && (
                        <Badge variant="outline">{suggestion.priority_focus.replace('_', ' ')}</Badge>
                      )}
                      {suggestion.biker && (
                        <span className="flex items-center gap-1">
                          <UserPlus className="h-4 w-4" />
                          {suggestion.biker.full_name}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/delivery/route-suggestions/${suggestion.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View Details
                      </Button>
                      
                      {suggestion.status === 'draft' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleApply(suggestion)}
                            disabled={applyRoute.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve & Apply
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDismiss(suggestion.id)}
                            disabled={dismissRoute.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Important Notice */}
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Auto-Route Suggestions Require Approval</p>
              <p className="text-sm text-muted-foreground">
                Routes are never auto-assigned. All suggestions must be reviewed and approved by Ops before 
                creating tasks. Click "Approve & Apply" to assign a biker and create the route.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assignment Dialog */}
        {selectedSuggestion && (
          <BikerAssignmentDialog
            open={assignDialogOpen}
            onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) setSelectedSuggestion(null);
            }}
            entityType="route"
            entityId={selectedSuggestion.id}
            entityName={selectedSuggestion.summary || 'Route Suggestion'}
            onAssigned={handleBikerAssigned}
          />
        )}
      </div>
    </Layout>
  );
};

export default RouteSuggestionsPage;
