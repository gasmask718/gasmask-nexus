import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, RefreshCw, User, Store, AlertTriangle, Lightbulb, 
  Phone, Clock, DollarSign, Truck, Package, Star, Flag
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  extractStoreProfileFromNotes, 
  saveExtractedProfile, 
  getExtractedProfile,
  type ExtractedProfile 
} from '@/services/profileExtractionService';

interface AIExtractedProfileCardProps {
  storeId: string;
  storeName?: string;
  notes?: string | null;
}

export function AIExtractedProfileCard({ storeId, storeName, notes }: AIExtractedProfileCardProps) {
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);

  // Fetch existing extracted profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['extracted-profile', storeId],
    queryFn: () => getExtractedProfile(storeId),
    enabled: !!storeId
  });

  // Extract and save profile
  const handleExtract = async () => {
    if (!notes && !storeName) {
      toast.error('No notes available to extract from');
      return;
    }

    setIsExtracting(true);
    try {
      // Get all notes for this store
      const notesArray = notes ? [notes] : [];

      const extracted = await extractStoreProfileFromNotes({
        storeId,
        storeName: storeName || 'Store',
        notes: notesArray
      });

      const result = await saveExtractedProfile(storeId, extracted);
      
      if (result.success) {
        toast.success('Profile extracted successfully!');
        queryClient.invalidateQueries({ queryKey: ['extracted-profile', storeId] });
      } else {
        toast.error(result.error || 'Failed to save profile');
      }
    } catch (e: any) {
      toast.error('Extraction failed: ' + e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI-Extracted Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI-Extracted Profile
            </CardTitle>
            <CardDescription>
              {profile ? `Confidence: ${Math.round((profile.extraction_confidence || 0) * 100)}%` : 'No profile extracted yet'}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExtract}
            disabled={isExtracting}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
            {profile ? 'Re-extract' : 'Extract'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!profile ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Extract" to analyze notes and build a profile</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {/* Personal Profile */}
              <ProfileSection 
                title="Personal Profile" 
                icon={User}
                color="text-blue-500"
              >
                {profile.personal_profile.owner_name && (
                  <ProfileItem label="Owner" value={profile.personal_profile.owner_name} />
                )}
                {profile.personal_profile.communication_style && (
                  <ProfileItem 
                    label="Communication" 
                    value={profile.personal_profile.communication_style} 
                    icon={Phone}
                  />
                )}
                {profile.personal_profile.loyalty_triggers && profile.personal_profile.loyalty_triggers.length > 0 && (
                  <ProfileItem 
                    label="Loyalty Triggers" 
                    value={profile.personal_profile.loyalty_triggers.join(', ')} 
                    icon={Star}
                  />
                )}
                {profile.personal_profile.restock_habits_summary && (
                  <ProfileItem 
                    label="Restock Habits" 
                    value={profile.personal_profile.restock_habits_summary} 
                    icon={Clock}
                  />
                )}
                {profile.personal_profile.personal_rapport_notes && (
                  <ProfileItem 
                    label="Rapport Notes" 
                    value={profile.personal_profile.personal_rapport_notes} 
                  />
                )}
              </ProfileSection>

              {/* Operational Profile */}
              <ProfileSection 
                title="Operational Profile" 
                icon={Store}
                color="text-green-500"
              >
                {profile.operational_profile.store_type && (
                  <ProfileItem label="Store Type" value={profile.operational_profile.store_type} />
                )}
                {profile.operational_profile.preferred_brands && profile.operational_profile.preferred_brands.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {profile.operational_profile.preferred_brands.map(brand => (
                      <Badge key={brand} variant="secondary" className="text-xs">{brand}</Badge>
                    ))}
                  </div>
                )}
                {profile.operational_profile.typical_order_pattern && (
                  <ProfileItem 
                    label="Order Pattern" 
                    value={profile.operational_profile.typical_order_pattern} 
                    icon={Package}
                  />
                )}
                {profile.operational_profile.payment_preferences && (
                  <ProfileItem 
                    label="Payment" 
                    value={profile.operational_profile.payment_preferences} 
                    icon={DollarSign}
                  />
                )}
                {profile.operational_profile.delivery_preference && (
                  <ProfileItem 
                    label="Delivery" 
                    value={profile.operational_profile.delivery_preference} 
                    icon={Truck}
                  />
                )}
                {profile.operational_profile.delivery_window && (
                  <ProfileItem 
                    label="Delivery Window" 
                    value={profile.operational_profile.delivery_window} 
                    icon={Clock}
                  />
                )}
                {profile.operational_profile.ambassador_potential && (
                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    Ambassador Potential
                  </Badge>
                )}
              </ProfileSection>

              {/* Red Flags */}
              {profile.red_flags.notes.length > 0 && (
                <ProfileSection 
                  title="Red Flags" 
                  icon={AlertTriangle}
                  color="text-red-500"
                >
                  <ul className="space-y-1">
                    {profile.red_flags.notes.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                        <Flag className="h-3 w-3 mt-1 flex-shrink-0" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </ProfileSection>
              )}

              {/* Opportunities */}
              {profile.opportunities.notes.length > 0 && (
                <ProfileSection 
                  title="Opportunities" 
                  icon={Lightbulb}
                  color="text-amber-500"
                >
                  <ul className="space-y-1">
                    {profile.opportunities.notes.map((opp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-600">
                        <Lightbulb className="h-3 w-3 mt-1 flex-shrink-0" />
                        {opp}
                      </li>
                    ))}
                  </ul>
                </ProfileSection>
              )}

              {/* Metadata */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Extracted from {profile.source_notes_count} note(s)
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Helper components
function ProfileSection({ 
  title, 
  icon: Icon, 
  color, 
  children 
}: { 
  title: string; 
  icon: React.ElementType; 
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg bg-card border">
      <h4 className={`text-sm font-medium flex items-center gap-2 mb-2 ${color}`}>
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function ProfileItem({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string; 
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {Icon && <Icon className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
