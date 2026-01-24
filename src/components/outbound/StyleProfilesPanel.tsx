import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, Plus, CheckCircle, XCircle, Clock, Shield,
  User, Sparkles, Volume2, Loader2, AlertTriangle,
  Lock, Unlock, FileSignature
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StyleProfile {
  id: string;
  name: string;
  description: string | null;
  pace: string;
  warmth: number;
  confidence: number;
  formality: number;
  energy: number;
  vocabulary_level: string;
  politeness_markers: string[];
  preferred_phrases: string[];
  avoided_phrases: string[];
  approved_campaign_types: string[];
  is_active: boolean;
  is_approved: boolean;
  approved_at: string | null;
  version: number;
  style_technique_attribution?: Array<{
    human_coach_name: string;
    source_type: string;
    sample_count: number;
  }>;
}

interface PromotionRequest {
  id: string;
  request_type: string;
  status: string;
  ai_reasoning: string | null;
  reviewed_at: string | null;
}

export function StyleProfilesPanel() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStyle, setNewStyle] = useState({
    name: '',
    description: '',
    pace: 'moderate' as const,
    warmth: 5,
    confidence: 7,
    formality: 5,
    energy: 5,
    vocabulary_level: 'standard' as const,
    coach_name: '',
    source_type: 'training_session' as const,
  });

  const { data: styles, isLoading } = useQuery({
    queryKey: ['style-profiles', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_style_profiles')
        .select(`
          *,
          style_technique_attribution (
            human_coach_name,
            source_type,
            sample_count
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as StyleProfile[];
    },
    enabled: !!businessId,
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['style-promotion-requests', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('style_promotion_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PromotionRequest[];
    },
    enabled: !!businessId,
  });

  const createStyleMutation = useMutation({
    mutationFn: async (styleData: typeof newStyle) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create style
      const { data: style, error: styleError } = await supabase
        .from('sales_style_profiles')
        .insert({
          business_id: businessId,
          name: styleData.name,
          description: styleData.description,
          pace: styleData.pace,
          warmth: styleData.warmth,
          confidence: styleData.confidence,
          formality: styleData.formality,
          energy: styleData.energy,
          vocabulary_level: styleData.vocabulary_level,
          created_by: user?.id,
          owner_user_id: user?.id,
          is_active: false,
          is_approved: false
        })
        .select()
        .single();

      if (styleError) throw styleError;

      // Create attribution
      const signatureData = JSON.stringify({
        style_id: style.id,
        coach: styleData.coach_name,
        source: styleData.source_type,
        date: new Date().toISOString()
      });
      
      // Simple hash for now
      const signatureHash = btoa(signatureData);

      await supabase.from('style_technique_attribution').insert({
        style_id: style.id,
        human_coach_id: user?.id,
        human_coach_name: styleData.coach_name,
        source_type: styleData.source_type,
        training_start_date: new Date().toISOString().split('T')[0],
        signature_hash: signatureHash
      });

      // Create promotion request
      await supabase.from('style_promotion_requests').insert({
        style_id: style.id,
        business_id: businessId,
        request_type: 'activate',
        requested_changes: styleData,
        ai_reasoning: 'New style profile created - awaiting human approval',
        proposed_by_ai: false,
        status: 'pending'
      });

      return style;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['style-promotion-requests'] });
      toast.success('Style profile created - awaiting approval');
      setCreateDialogOpen(false);
      resetNewStyle();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create style: ${error.message}`);
    }
  });

  const approveStyleMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: request } = await supabase
        .from('style_promotion_requests')
        .select('style_id')
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      // Update request
      await supabase
        .from('style_promotion_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rollback_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', requestId);

      // Activate style
      await supabase
        .from('sales_style_profiles')
        .update({
          is_active: true,
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.style_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['style-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['style-promotion-requests'] });
      toast.success('Style approved and activated');
    }
  });

  const resetNewStyle = () => {
    setNewStyle({
      name: '',
      description: '',
      pace: 'moderate',
      warmth: 5,
      confidence: 7,
      formality: 5,
      energy: 5,
      vocabulary_level: 'standard',
      coach_name: '',
      source_type: 'training_session',
    });
  };

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please select a business</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Approvals Banner */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">{pendingRequests.length} style(s) awaiting approval</p>
                  <p className="text-sm text-muted-foreground">
                    Human signature required to activate
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Review All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Sales Style Profiles
          </h3>
          <p className="text-sm text-muted-foreground">
            Style affects tone, not strategy. Human approval required.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Style
        </Button>
      </div>

      {/* Boundary Rules Info */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Style Boundary Rules (Immutable)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Disclosure text
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Permission question
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Escalation triggers
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Forbidden behaviors
                </span>
                <span className="flex items-center gap-1">
                  <Unlock className="h-3 w-3 text-green-500" /> Word choice (flexible)
                </span>
                <span className="flex items-center gap-1">
                  <Unlock className="h-3 w-3 text-green-500" /> Politeness (flexible)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : styles?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No style profiles yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first style to customize AI voice behavior
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Style
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {styles?.map((style) => (
            <Card key={style.id} className={style.is_active ? 'border-green-500' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      {style.name}
                    </CardTitle>
                    {style.description && (
                      <CardDescription className="mt-1">
                        {style.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {style.is_approved ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    <Switch checked={style.is_active} disabled={!style.is_approved} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tone Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Warmth</span>
                      <span>{style.warmth}/10</span>
                    </div>
                    <Progress value={style.warmth * 10} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Confidence</span>
                      <span>{style.confidence}/10</span>
                    </div>
                    <Progress value={style.confidence * 10} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Formality</span>
                      <span>{style.formality}/10</span>
                    </div>
                    <Progress value={style.formality * 10} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Energy</span>
                      <span>{style.energy}/10</span>
                    </div>
                    <Progress value={style.energy * 10} className="h-2" />
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <Badge variant="outline">{style.pace} pace</Badge>
                  <Badge variant="outline">{style.vocabulary_level}</Badge>
                  <span>v{style.version}</span>
                </div>

                {/* Attribution */}
                {style.style_technique_attribution?.[0] && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3 w-3" />
                    <span>Coach: {style.style_technique_attribution[0].human_coach_name}</span>
                    <span className="text-muted-foreground">
                      ({style.style_technique_attribution[0].source_type})
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Style Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Create Style Profile
            </DialogTitle>
            <DialogDescription>
              Define tone parameters and attribute to a human coach. Requires approval to activate.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Style Name *</Label>
                <Input
                  value={newStyle.name}
                  onChange={(e) => setNewStyle({ ...newStyle, name: e.target.value })}
                  placeholder="e.g., Calm Consultant"
                />
              </div>
              <div className="space-y-2">
                <Label>Vocabulary Level</Label>
                <Select
                  value={newStyle.vocabulary_level}
                  onValueChange={(v) => setNewStyle({ ...newStyle, vocabulary_level: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newStyle.description}
                onChange={(e) => setNewStyle({ ...newStyle, description: e.target.value })}
                placeholder="Describe this style's approach..."
              />
            </div>

            {/* Tone Sliders */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Tone Parameters</Label>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Warmth</span>
                    <span className="text-sm text-muted-foreground">{newStyle.warmth}</span>
                  </div>
                  <Slider
                    value={[newStyle.warmth]}
                    onValueChange={([v]) => setNewStyle({ ...newStyle, warmth: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Confidence</span>
                    <span className="text-sm text-muted-foreground">{newStyle.confidence}</span>
                  </div>
                  <Slider
                    value={[newStyle.confidence]}
                    onValueChange={([v]) => setNewStyle({ ...newStyle, confidence: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Formality</span>
                    <span className="text-sm text-muted-foreground">{newStyle.formality}</span>
                  </div>
                  <Slider
                    value={[newStyle.formality]}
                    onValueChange={([v]) => setNewStyle({ ...newStyle, formality: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Energy</span>
                    <span className="text-sm text-muted-foreground">{newStyle.energy}</span>
                  </div>
                  <Slider
                    value={[newStyle.energy]}
                    onValueChange={([v]) => setNewStyle({ ...newStyle, energy: v })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pace</Label>
                <Select
                  value={newStyle.pace}
                  onValueChange={(v) => setNewStyle({ ...newStyle, pace: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attribution (REQUIRED) */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Human Attribution (Required)
              </Label>
              <p className="text-xs text-muted-foreground">
                No anonymous styles. Every style must be attributed to a human coach.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coach Name *</Label>
                  <Input
                    value={newStyle.coach_name}
                    onChange={(e) => setNewStyle({ ...newStyle, coach_name: e.target.value })}
                    placeholder="e.g., Sarah Johnson"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select
                    value={newStyle.source_type}
                    onValueChange={(v) => setNewStyle({ ...newStyle, source_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call_recording">Call Recording</SelectItem>
                      <SelectItem value="script">Script</SelectItem>
                      <SelectItem value="training_session">Training Session</SelectItem>
                      <SelectItem value="live_observation">Live Observation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createStyleMutation.mutate(newStyle)}
              disabled={!newStyle.name || !newStyle.coach_name || createStyleMutation.isPending}
            >
              {createStyleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create & Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
