import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Mic, 
  Upload, 
  Volume2, 
  Play, 
  Settings, 
  Plus,
  Wand2,
  User,
  Globe,
  Sparkles
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import VoiceUploadPanel from '@/components/communication/voice/VoiceUploadPanel';
import VoiceRecorderPanel from '@/components/communication/voice/VoiceRecorderPanel';
import VoiceAssignmentPanel from '@/components/communication/voice/VoiceAssignmentPanel';

const DEFAULT_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', gender: 'female', tone: ['warm', 'professional'] },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', tone: ['confident', 'friendly'] },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', tone: ['calm', 'empathetic'] },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', tone: ['authoritative', 'warm'] },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', tone: ['energetic', 'persuasive'] },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', tone: ['professional', 'calm'] },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', tone: ['soft', 'friendly'] },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', tone: ['dynamic', 'engaging'] },
];

export default function VoiceLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: voiceProfiles, isLoading } = useQuery({
    queryKey: ['voice-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredVoices = DEFAULT_VOICES.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voice Library</h1>
          <p className="text-muted-foreground">
            Manage AI voices, upload custom recordings, and assign voices to campaigns
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Voice
        </Button>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="available" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Available
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="record" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger value="assign" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Assign
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input 
              placeholder="Search voices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2">
              <Badge variant="outline">All</Badge>
              <Badge variant="outline">Male</Badge>
              <Badge variant="outline">Female</Badge>
              <Badge variant="outline">Custom</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVoices.map((voice) => (
              <Card key={voice.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{voice.name}</CardTitle>
                        <CardDescription className="capitalize">{voice.gender}</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {voice.tone.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>English</span>
                    <Sparkles className="h-3 w-3 ml-2" />
                    <span>ElevenLabs</span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Custom Voices */}
            {voiceProfiles?.map((profile) => (
              <Card key={profile.id} className="hover:border-primary/50 transition-colors border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{profile.name}</CardTitle>
                        <CardDescription className="capitalize">{profile.provider}</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {profile.voice_type}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{profile.language || 'English'}</span>
                    <Badge variant="outline" className="ml-auto text-xs">Custom</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <VoiceUploadPanel />
        </TabsContent>

        <TabsContent value="record">
          <VoiceRecorderPanel />
        </TabsContent>

        <TabsContent value="assign">
          <VoiceAssignmentPanel />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
              <CardDescription>Configure global voice preferences and defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Default Voice Provider</p>
                  <p className="text-sm text-muted-foreground">Select the primary TTS provider</p>
                </div>
                <Badge>ElevenLabs</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Enable Voice Switching</p>
                  <p className="text-sm text-muted-foreground">Allow AI to switch voices mid-call based on context</p>
                </div>
                <Badge variant="secondary">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Emotional Adaptation</p>
                  <p className="text-sm text-muted-foreground">Adjust voice tone based on sentiment analysis</p>
                </div>
                <Badge variant="secondary">Enabled</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
