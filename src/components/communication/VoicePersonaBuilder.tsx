import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, User, Mic, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'sonner';
import ToneSelector from './ToneSelector';

interface VoicePersona {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  voice_profile_id: string | null;
  tone: string;
  language: string;
  use_for_ai_texts: boolean;
  use_for_ai_calls: boolean;
  is_default: boolean;
}

interface VoicePersonaBuilderProps {
  businessId?: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'zh', label: 'Chinese' },
];

export default function VoicePersonaBuilder({ businessId }: VoicePersonaBuilderProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<VoicePersona | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    voice_profile_id: '',
    tone: 'professional',
    language: 'en',
    use_for_ai_texts: true,
    use_for_ai_calls: true,
    is_default: false,
  });

  const { data: personas, isLoading } = useQuery({
    queryKey: ['voice-personas', businessId],
    queryFn: async () => {
      let query = supabase.from('voice_personas').select('*').order('is_default', { ascending: false });
      if (businessId) {
        query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as VoicePersona[];
    }
  });

  const { data: voiceProfiles } = useQuery({
    queryKey: ['voice-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_profiles').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('id, name');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { business_id?: string }) => {
      const { error } = await supabase.from('voice_personas').insert({
        ...data,
        business_id: businessId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-personas'] });
      toast.success('Persona created successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to create persona'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from('voice_personas').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-personas'] });
      toast.success('Persona updated successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to update persona'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('voice_personas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-personas'] });
      toast.success('Persona deleted');
    },
    onError: () => toast.error('Failed to delete persona'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      voice_profile_id: '',
      tone: 'professional',
      language: 'en',
      use_for_ai_texts: true,
      use_for_ai_calls: true,
      is_default: false,
    });
    setEditingPersona(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (persona: VoicePersona) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      description: persona.description || '',
      voice_profile_id: persona.voice_profile_id || '',
      tone: persona.tone,
      language: persona.language,
      use_for_ai_texts: persona.use_for_ai_texts,
      use_for_ai_calls: persona.use_for_ai_calls,
      is_default: persona.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }
    if (editingPersona) {
      updateMutation.mutate({ id: editingPersona.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Voice Personas
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPersona ? 'Edit Persona' : 'Create Voice Persona'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Persona Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Founder Voice, Hot Mama Soft"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this persona's style"
                />
              </div>
              <div>
                <Label>Voice Profile</Label>
                <Select
                  value={formData.voice_profile_id}
                  onValueChange={(v) => setFormData({ ...formData, voice_profile_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceProfiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ToneSelector value={formData.tone} onChange={(v) => setFormData({ ...formData, tone: v })} />
              <div>
                <Label>Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(v) => setFormData({ ...formData, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Use for AI Texts</Label>
                <Switch
                  checked={formData.use_for_ai_texts}
                  onCheckedChange={(v) => setFormData({ ...formData, use_for_ai_texts: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Use for AI Calls</Label>
                <Switch
                  checked={formData.use_for_ai_calls}
                  onCheckedChange={(v) => setFormData({ ...formData, use_for_ai_calls: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Set as Default</Label>
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={resetForm} className="flex-1">Cancel</Button>
                <Button onClick={handleSubmit} className="flex-1">
                  {editingPersona ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading personas...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tone</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Used For</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas?.map((persona) => (
                <TableRow key={persona.id}>
                  <TableCell className="font-medium">{persona.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{persona.tone}</Badge>
                  </TableCell>
                  <TableCell>{LANGUAGES.find(l => l.value === persona.language)?.label}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {persona.use_for_ai_texts && (
                        <Badge variant="secondary" className="text-xs">
                          <MessageSquare className="w-3 h-3 mr-1" />SMS
                        </Badge>
                      )}
                      {persona.use_for_ai_calls && (
                        <Badge variant="secondary" className="text-xs">
                          <Phone className="w-3 h-3 mr-1" />Calls
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {persona.is_default && <Badge>Default</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(persona)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(persona.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!personas?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No personas created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
