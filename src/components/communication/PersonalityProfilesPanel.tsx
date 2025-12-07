import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Plus, User, Briefcase, Laugh, Crown, Mic2 } from 'lucide-react';
import { PersonalityProfile, LanguageProfile } from '@/hooks/useLanguagePersonality';

interface PersonalityProfilesPanelProps {
  profiles: PersonalityProfile[];
  languageProfiles: LanguageProfile[];
  isLoading: boolean;
  onCreateProfile: (profile: Omit<PersonalityProfile, 'id' | 'created_at'>) => void;
  businessId?: string;
}

const toneIcons: Record<string, React.ReactNode> = {
  professional: <Briefcase className="w-4 h-4" />,
  street_smart: <Mic2 className="w-4 h-4" />,
  luxury: <Crown className="w-4 h-4" />,
  playful: <Laugh className="w-4 h-4" />,
  friendly: <User className="w-4 h-4" />,
};

const toneColors: Record<string, string> = {
  professional: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  street_smart: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  luxury: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  playful: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  friendly: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function PersonalityProfilesPanel({
  profiles,
  languageProfiles,
  isLoading,
  onCreateProfile,
  businessId,
}: PersonalityProfilesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    base_tone: 'professional',
    formality: 'neutral',
    emoji_style: 'light',
    slang_level: 'none',
    language_profile_id: null as string | null,
    business_id: businessId || null,
  });

  const handleCreate = () => {
    onCreateProfile(newProfile);
    setIsOpen(false);
    setNewProfile({
      name: '',
      description: '',
      base_tone: 'professional',
      formality: 'neutral',
      emoji_style: 'light',
      slang_level: 'none',
      language_profile_id: null,
      business_id: businessId || null,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Personality Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Personality Profiles
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Personality Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  placeholder="e.g., Founder Voice - Warm"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newProfile.description}
                  onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                  placeholder="Describe this personality..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Tone</Label>
                  <Select
                    value={newProfile.base_tone}
                    onValueChange={(v) => setNewProfile({ ...newProfile, base_tone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="street_smart">Street Smart</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formality</Label>
                  <Select
                    value={newProfile.formality}
                    onValueChange={(v) => setNewProfile({ ...newProfile, formality: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Emoji Style</Label>
                  <Select
                    value={newProfile.emoji_style || 'light'}
                    onValueChange={(v) => setNewProfile({ ...newProfile, emoji_style: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Slang Level</Label>
                  <Select
                    value={newProfile.slang_level || 'none'}
                    onValueChange={(v) => setNewProfile({ ...newProfile, slang_level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Language Profile</Label>
                <Select
                  value={newProfile.language_profile_id || ''}
                  onValueChange={(v) => setNewProfile({ ...newProfile, language_profile_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent>
                    {languageProfiles?.map((lp) => (
                      <SelectItem key={lp.id} value={lp.id}>
                        {lp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!newProfile.name}>
                Create Profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {profiles?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No personality profiles yet. Create one to get started.
            </p>
          ) : (
            profiles?.map((profile) => (
              <div
                key={profile.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {toneIcons[profile.base_tone] || <Sparkles className="w-4 h-4" />}
                      {profile.name}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
                  </div>
                  <Badge className={toneColors[profile.base_tone] || 'bg-muted'}>
                    {profile.base_tone.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {profile.formality}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Emoji: {profile.emoji_style}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Slang: {profile.slang_level}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
