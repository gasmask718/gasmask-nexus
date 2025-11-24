import { useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

interface CustomerNotesSimpleEditorProps {
  contactId: string;
  initialNotes?: string | null;
  onSave?: () => void;
}

export const CustomerNotesSimpleEditor = ({ 
  contactId, 
  initialNotes, 
  onSave 
}: CustomerNotesSimpleEditorProps) => {
  const { currentBusiness } = useBusiness();
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentBusiness?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('crm_contacts')
        .update({ notes })
        .eq('id', contactId)
        .eq('business_id', currentBusiness.id);

      if (error) throw error;

      toast({
        title: 'Notes Saved',
        description: 'Contact notes have been updated.',
      });

      onSave?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Notes</h3>
        <Button 
          size="sm" 
          onClick={handleSave} 
          disabled={saving || notes === initialNotes}
        >
          <Save className="mr-2 h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this contact..."
        className="min-h-[120px] resize-none"
      />
    </Card>
  );
};
