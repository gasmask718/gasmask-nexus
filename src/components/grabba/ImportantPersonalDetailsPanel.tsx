import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Globe, Store, TrendingUp, ShoppingCart, Heart, MessageCircle, 
  AlertTriangle, Sparkles, Users, Clock, Edit, RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { runMemoryExtractionV5 } from '@/services/profileExtractionService';
import { toast } from 'sonner';
import { useState } from 'react';

interface ImportantPersonalDetailsPanelProps {
  storeId: string;
  storeMaster: {
    store_name: string;
    owner_name?: string | null;
    nickname?: string | null;
    country_of_origin?: string | null;
    languages?: string[] | null;
    communication_preference?: string | null;
    personality_notes?: string | null;
    has_expansion?: boolean | null;
    new_store_addresses?: string[] | null;
    expected_open_dates?: string[] | null;
    expansion_notes?: string | null;
    influence_level?: string | null;
    loyalty_triggers?: string[] | null;
    frustration_triggers?: string[] | null;
    risk_score?: string | null;
    notes?: string | null;
  };
}

export function ImportantPersonalDetailsPanel({ storeId, storeMaster }: ImportantPersonalDetailsPanelProps) {
  const [isExtracting, setIsExtracting] = useState(false);

  // Fetch extracted profile for AI-generated insights
  const { data: extractedProfile, refetch: refetchProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['store-extracted-profile-v6', storeId],
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

  const handleExtraction = async () => {
    setIsExtracting(true);
    toast.info('Running AI extraction to update personal details...');
    const result = await runMemoryExtractionV5(storeId);
    if (result.success) {
      toast.success('Personal details updated!');
      refetchProfile();
    } else {
      toast.error(result.error || 'Extraction failed');
    }
    setIsExtracting(false);
  };

  const personalProfile = extractedProfile?.personal_profile as Record<string, any> | null;
  const operationalProfile = extractedProfile?.operational_profile as Record<string, any> | null;
  const redFlags = (extractedProfile?.red_flags as string[]) || [];
  const opportunities = (extractedProfile?.opportunities as string[]) || [];

  // Collect alternate names from owner_name, nickname, etc.
  const alternateNames: string[] = [];
  if (storeMaster.owner_name && storeMaster.owner_name !== storeMaster.store_name) {
    alternateNames.push(storeMaster.owner_name);
  }
  if (storeMaster.nickname && storeMaster.nickname !== storeMaster.store_name) {
    alternateNames.push(storeMaster.nickname);
  }

  // Check for missing required data
  const missingFields: string[] = [];
  if (!storeMaster.country_of_origin) missingFields.push('Country of Origin');
  if (!storeMaster.communication_preference) missingFields.push('Communication Preference');
  if (!storeMaster.personality_notes && !personalProfile?.background) missingFields.push('Personality Notes');

  return (
    <Card className="w-full border-2 border-primary/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Important Personal Details
            </CardTitle>
            <CardDescription>
              Key intelligence for sales, retention, and rapport building
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Manually
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleExtraction}
              disabled={isExtracting}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
              {isExtracting ? 'Updating...' : 'Refresh AI'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Missing Data Warning */}
        {missingFields.length > 0 && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              This profile is missing required data: {missingFields.join(', ')}. Please update store_master.
            </p>
          </div>
        )}

        {/* Multi-Name Display */}
        {alternateNames.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <Users className="h-3 w-3" /> More Names
            </span>
            <div className="flex flex-wrap gap-2">
              {alternateNames.map((name, i) => (
                <Badge key={i} variant="secondary">{name}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Country */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Country
            </span>
            <p className="text-sm font-medium">
              {storeMaster.country_of_origin || <span className="text-muted-foreground italic">Not set</span>}
            </p>
            {storeMaster.languages && storeMaster.languages.length > 0 && (
              <div className="flex gap-1 mt-1">
                {storeMaster.languages.map((lang, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{lang}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Communication Style */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> Communication Style
            </span>
            <p className="text-sm font-medium">
              {storeMaster.communication_preference || 
               personalProfile?.communication_style || 
               <span className="text-muted-foreground italic">Not set</span>}
            </p>
          </div>

          {/* Influence Level */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Influence Level
            </span>
            <p className="text-sm font-medium">
              {storeMaster.influence_level ? (
                <Badge variant={
                  storeMaster.influence_level === 'high' ? 'default' : 
                  storeMaster.influence_level === 'medium' ? 'secondary' : 'outline'
                }>
                  {storeMaster.influence_level}
                </Badge>
              ) : (
                <span className="text-muted-foreground italic">Not rated</span>
              )}
            </p>
          </div>
        </div>

        {/* Personality & Relationship Notes */}
        <div className="space-y-3">
          {(storeMaster.personality_notes || personalProfile?.background) && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground block mb-1">Personality & Background</span>
              <p className="text-sm">{storeMaster.personality_notes || personalProfile?.background}</p>
            </div>
          )}

          {personalProfile?.relationship_notes && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground block mb-1">Relationship Notes</span>
              <p className="text-sm">{personalProfile.relationship_notes}</p>
            </div>
          )}

          {personalProfile?.family_details && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground block mb-1">Family / People Connected</span>
              <p className="text-sm">{personalProfile.family_details}</p>
            </div>
          )}
        </div>

        {/* Expansion / New Stores */}
        {storeMaster.has_expansion && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <span className="text-xs text-blue-400 block mb-1 flex items-center gap-1">
              <Store className="h-3 w-3" /> Known New Stores / Expansion
            </span>
            {storeMaster.new_store_addresses && storeMaster.new_store_addresses.length > 0 && (
              <ul className="text-sm list-disc list-inside">
                {storeMaster.new_store_addresses.map((addr, i) => (
                  <li key={i}>{addr}</li>
                ))}
              </ul>
            )}
            {storeMaster.expansion_notes && (
              <p className="text-sm mt-2">{storeMaster.expansion_notes}</p>
            )}
          </div>
        )}

        {/* Buying Behavior & Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Loyalty Triggers */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-green-500" />
              Loyalty Triggers
            </h4>
            {storeMaster.loyalty_triggers && storeMaster.loyalty_triggers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {storeMaster.loyalty_triggers.map((trigger, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
                    {trigger}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
          </div>

          {/* Frustration Triggers */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Frustration Triggers
            </h4>
            {storeMaster.frustration_triggers && storeMaster.frustration_triggers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {storeMaster.frustration_triggers.map((trigger, i) => (
                  <Badge key={i} variant="secondary" className="bg-orange-500/20 text-orange-400 text-xs">
                    {trigger}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
          </div>
        </div>

        {/* Opportunities & Red Flags from AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-500" />
              Wholesale Opportunities
            </h4>
            {opportunities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {opportunities.map((opp, i) => (
                  <Badge key={i} className="bg-green-500/20 text-green-400 text-xs">{opp}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None identified yet</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Risk Factors
            </h4>
            {(redFlags.length > 0 || storeMaster.risk_score) ? (
              <div className="space-y-2">
                {storeMaster.risk_score && (
                  <Badge variant={
                    storeMaster.risk_score === 'high' ? 'destructive' :
                    storeMaster.risk_score === 'medium' ? 'secondary' : 'outline'
                  }>
                    Risk: {storeMaster.risk_score}
                  </Badge>
                )}
                {redFlags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {redFlags.map((flag, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{flag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk factors recorded</p>
            )}
          </div>
        </div>

        {/* Buying Behavior from AI */}
        {operationalProfile?.buying_behavior && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Buying Behavior
            </span>
            <p className="text-sm">{operationalProfile.buying_behavior}</p>
          </div>
        )}

        {/* AI Updated Timestamp */}
        <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {extractedProfile?.last_extracted_at ? (
              <>AI Updated: {new Date(extractedProfile.last_extracted_at).toLocaleString()}</>
            ) : (
              <>No AI extraction yet</>
            )}
          </span>
          {extractedProfile?.extraction_confidence && (
            <span>Confidence: {Math.round(Number(extractedProfile.extraction_confidence) * 100)}%</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
