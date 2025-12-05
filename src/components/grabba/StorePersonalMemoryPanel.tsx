import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Heart, AlertTriangle, Sparkles, RefreshCw, Brain } from 'lucide-react';
import { runMemoryExtractionV5 } from '@/services/profileExtractionService';
import { toast } from 'sonner';

interface StorePersonalMemoryPanelProps {
  storeId: string;
}

export function StorePersonalMemoryPanel({ storeId }: StorePersonalMemoryPanelProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['store-extracted-profile', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_extracted_profiles')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const personalProfile = profile?.personal_profile as Record<string, any> | null;
  const operationalProfile = profile?.operational_profile as Record<string, any> | null;
  const redFlags = (profile?.red_flags as string[]) || [];
  const opportunities = (profile?.opportunities as string[]) || [];

  const handleRunExtraction = async () => {
    setIsExtracting(true);
    toast.info('Running AI Memory Extraction...');
    
    const result = await runMemoryExtractionV5(storeId);
    
    if (result.success) {
      toast.success('AI Memory Extraction complete!');
      queryClient.invalidateQueries({ queryKey: ['store-extracted-profile', storeId] });
      refetch();
    } else {
      toast.error(result.error || 'Extraction failed');
    }
    
    setIsExtracting(false);
  };

  return (
    <Card className="w-full border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Personal Memory Panel
            </CardTitle>
            <CardDescription>
              Extracted human details, relationship insights, and communication preferences
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRunExtraction} 
              disabled={isExtracting}
            >
              <Brain className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-pulse' : ''}`} />
              {isExtracting ? 'Extracting...' : 'Run V5 Extraction'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading && (
          <div className="text-muted-foreground text-center py-4">Loading personal insights...</div>
        )}

        {!isLoading && !profile && (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-3">No personal memory extracted yet.</p>
            <p className="text-sm text-muted-foreground">Run the AI extractor to populate this panel.</p>
          </div>
        )}

        {!isLoading && profile && (
          <>
            {/* Personal Profile Section */}
            {personalProfile && Object.keys(personalProfile).length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Personal Details
                </h3>
                <div className="grid gap-3">
                  {personalProfile.background && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">Background</span>
                      <p className="text-sm">{personalProfile.background}</p>
                    </div>
                  )}
                  {personalProfile.family_details && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">Family / Connections</span>
                      <p className="text-sm">{personalProfile.family_details}</p>
                    </div>
                  )}
                  {personalProfile.communication_style && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">Communication Style</span>
                      <p className="text-sm">{personalProfile.communication_style}</p>
                    </div>
                  )}
                  {personalProfile.relationship_notes && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">Relationship Notes</span>
                      <p className="text-sm">{personalProfile.relationship_notes}</p>
                    </div>
                  )}
                  {/* Render any other personal profile fields */}
                  {Object.entries(personalProfile)
                    .filter(([key]) => !['background', 'family_details', 'communication_style', 'relationship_notes'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="p-3 rounded-lg bg-muted/50">
                        <span className="text-xs text-muted-foreground block mb-1 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <p className="text-sm">{String(value)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Operational Profile Section */}
            {operationalProfile && Object.keys(operationalProfile).length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Operational Profile</h3>
                <div className="grid gap-3">
                  {Object.entries(operationalProfile).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Red Flags & Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Red Flags
                </h3>
                {redFlags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {redFlags.map((flag, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No red flags recorded</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  Opportunities
                </h3>
                {opportunities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {opportunities.map((opp, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                        {opp}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No opportunities documented</p>
                )}
              </div>
            </div>

            {/* Extraction Meta */}
            {profile.last_extracted_at && (
              <div className="pt-4 border-t text-xs text-muted-foreground">
                Last extracted: {new Date(profile.last_extracted_at).toLocaleString()}
                {profile.extraction_confidence && (
                  <span className="ml-4">
                    Confidence: {Math.round(Number(profile.extraction_confidence) * 100)}%
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
