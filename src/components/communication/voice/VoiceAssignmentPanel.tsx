import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Volume2, Users, Megaphone, Building2, CheckCircle, Wand2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
];

interface Assignment {
  id: string;
  type: 'persona' | 'campaign' | 'business';
  name: string;
  currentVoice: string | null;
}

export default function VoiceAssignmentPanel() {
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const { data: personas } = useQuery({
    queryKey: ['voice-personas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('voice_personas')
        .select('id, name')
        .limit(10);
      return data || [];
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ['ai-campaigns-voice'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_campaigns')
        .select('id, name, persona_id')
        .limit(10);
      return data || [];
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ['businesses-voice'],
    queryFn: async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, name')
        .limit(10);
      return data || [];
    },
  });

  const handleAssign = (entityId: string, voiceId: string) => {
    setAssignments(prev => ({ ...prev, [entityId]: voiceId }));
  };

  const getVoiceName = (voiceId: string | null) => {
    if (!voiceId) return 'Not assigned';
    const voice = DEFAULT_VOICES.find(v => v.id === voiceId);
    return voice?.name || voiceId;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Persona Voice Assignments
          </CardTitle>
          <CardDescription>
            Assign voices to AI personas for consistent character representation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Current Voice</TableHead>
                <TableHead>Assign New Voice</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas?.map((persona) => (
                <TableRow key={persona.id}>
                  <TableCell className="font-medium">{persona.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Not assigned</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={assignments[persona.id] || ''}
                      onValueChange={(v) => handleAssign(persona.id, v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {assignments[persona.id] && (
                      <Button size="sm" variant="ghost">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!personas || personas.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No personas found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaign Voice Assignments
          </CardTitle>
          <CardDescription>
            Override default voices for specific campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assign Voice</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns?.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Active</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={assignments[`campaign-${campaign.id}`] || ''}
                      onValueChange={(v) => handleAssign(`campaign-${campaign.id}`, v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Use persona default" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {assignments[`campaign-${campaign.id}`] && (
                      <Button size="sm" variant="ghost">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!campaigns || campaigns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No campaigns found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Default Voices
          </CardTitle>
          <CardDescription>
            Set default voices per business for brand consistency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Default Voice</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses?.map((business) => (
                <TableRow key={business.id}>
                  <TableCell className="font-medium">{business.name}</TableCell>
                  <TableCell>
                    <Select
                      value={assignments[`business-${business.id}`] || ''}
                      onValueChange={(v) => handleAssign(`business-${business.id}`, v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select default" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {assignments[`business-${business.id}`] && (
                      <Button size="sm" variant="ghost">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!businesses || businesses.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No businesses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>
          <Wand2 className="h-4 w-4 mr-2" />
          Save All Assignments
        </Button>
      </div>
    </div>
  );
}
