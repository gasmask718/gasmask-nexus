import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, Mic } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useSpeakerStyles,
  useCreateSpeakerStyle,
  SpeakerStyleProfile,
} from '@/hooks/usePlaybooks';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { StyleCard } from './StyleCard';
import { StyleEditor } from './StyleEditor';

export function StylesManager() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: styles, isLoading } = useSpeakerStyles(businessId);
  const createStyle = useCreateSpeakerStyle();

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<SpeakerStyleProfile | null>(null);

  const filtered = styles?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.tone.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from('speaker_style_profiles')
      .update({ is_active: active })
      .eq('id', id);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['speaker-styles'] });
    }
  };

  const handleEdit = (style: SpeakerStyleProfile) => {
    setEditingStyle(style);
    setEditorOpen(true);
  };

  const handleSave = async (data: Partial<SpeakerStyleProfile>) => {
    if (editingStyle) {
      const { error } = await supabase
        .from('speaker_style_profiles')
        .update(data)
        .eq('id', editingStyle.id);

      if (error) {
        toast({ title: 'Failed to update', variant: 'destructive' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['speaker-styles'] });
        toast({ title: 'Style updated' });
      }
    } else {
      createStyle.mutate(data as Partial<SpeakerStyleProfile> & { business_id: string; name: string });
    }
    setEditingStyle(null);
  };

  if (!businessId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a business to manage styles
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Speaker Styles</h2>
            <p className="text-sm text-muted-foreground">
              Control how the AI sounds — not what it decides
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditingStyle(null); setEditorOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Style
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search styles or tones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Style List */}
      {filtered && filtered.length > 0 ? (
        <div className="grid gap-4">
          {filtered.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onToggleActive={handleToggleActive}
              onEdit={handleEdit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Mic className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-1">No style profiles yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first style to customize AI voice
          </p>
          <Button onClick={() => { setEditingStyle(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Style
          </Button>
        </div>
      )}

      {/* Editor Modal */}
      <StyleEditor
        style={editingStyle}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingStyle(null); }}
        onSave={handleSave}
        businessId={businessId}
      />
    </div>
  );
}
