import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mic, User, Building2, Bot } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface VoiceProfile {
  id: string;
  name: string;
  voice_type: 'personal' | 'brand' | 'neutral';
  voice_model_id: string | null;
  description: string | null;
  is_founder_voice: boolean;
  business_id: string | null;
}

interface VoiceProfileSelectorProps {
  value: string;
  onChange: (value: string, profile: VoiceProfile | null) => void;
  businessId?: string;
  showFounderBadge?: boolean;
}

export default function VoiceProfileSelector({ 
  value, 
  onChange, 
  businessId,
  showFounderBadge = true 
}: VoiceProfileSelectorProps) {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['voice-profiles', businessId],
    queryFn: async () => {
      let query = supabase
        .from('voice_profiles')
        .select('*')
        .order('is_founder_voice', { ascending: false });
      
      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as VoiceProfile[];
    }
  });

  const getVoiceIcon = (type: string, isFounder: boolean) => {
    if (isFounder) return <User className="w-4 h-4 text-primary" />;
    switch (type) {
      case 'personal': return <Mic className="w-4 h-4 text-green-500" />;
      case 'brand': return <Building2 className="w-4 h-4 text-blue-500" />;
      default: return <Bot className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleChange = (profileId: string) => {
    const profile = profiles?.find(p => p.id === profileId) || null;
    onChange(profileId, profile);
  };

  const selectedProfile = profiles?.find(p => p.id === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Mic className="w-4 h-4" />
        Voice Profile
      </Label>
      <Select value={value} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select voice profile">
            {selectedProfile && (
              <div className="flex items-center gap-2">
                {getVoiceIcon(selectedProfile.voice_type, selectedProfile.is_founder_voice)}
                <span>{selectedProfile.name}</span>
                {selectedProfile.is_founder_voice && showFounderBadge && (
                  <Badge variant="secondary" className="text-xs">Founder</Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {profiles?.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              <div className="flex items-center gap-2">
                {getVoiceIcon(profile.voice_type, profile.is_founder_voice)}
                <span>{profile.name}</span>
                {profile.is_founder_voice && showFounderBadge && (
                  <Badge variant="secondary" className="text-xs ml-2">Founder</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedProfile?.description && (
        <p className="text-xs text-muted-foreground">{selectedProfile.description}</p>
      )}
    </div>
  );
}
