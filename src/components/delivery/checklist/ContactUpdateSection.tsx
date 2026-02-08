import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, User, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { cn } from '@/lib/utils';

interface ContactInfo {
  id?: string;
  name: string;
  role: string;
  phone: string;
  responsiveByCall: boolean;
  responsiveByText: boolean;
  isNew?: boolean;
}

interface ContactUpdateSectionProps {
  storeId: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  contactData: Record<string, any>;
  onContactUpdate: (data: Record<string, any>) => void;
}

export function ContactUpdateSection({
  storeId,
  isTaskCompleted,
  onToggleTask,
  progress,
  contactData,
  onContactUpdate,
}: ContactUpdateSectionProps) {
  const tasks = getTasksByCategory('contacts');
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [spokeWith, setSpokeWith] = useState(contactData.spokeWith || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      const { data } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('store_id', storeId);

      if (data) {
        setContacts(data.map(c => ({
          id: c.id,
          name: c.name || '',
          role: c.role || '',
          phone: c.phone || '',
          responsiveByCall: c.responsive_by_call || false,
          responsiveByText: c.responsive_by_text || false,
        })));
      }
      setLoading(false);
    }
    fetchContacts();
  }, [storeId]);

  const addNewContact = () => {
    const updated = [...contacts, { name: '', role: '', phone: '', responsiveByCall: false, responsiveByText: false, isNew: true }];
    setContacts(updated);
    onContactUpdate({ ...contactData, contacts: updated, spokeWith });
  };

  const updateContact = (index: number, field: keyof ContactInfo, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
    onContactUpdate({ ...contactData, contacts, spokeWith });
  };

  const handleSpokeWithChange = (value: string) => {
    setSpokeWith(value);
    onContactUpdate({ ...contactData, contacts, spokeWith: value });
  };

  return (
    <ChecklistSection
      title="Contact Intelligence"
      icon={<Phone className="h-5 w-5" />}
      category="contacts"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      accentColor="text-cyan-500"
    >
      <div className="space-y-4">
        {/* Who you spoke with */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Who did you speak with?
          </Label>
          <Input
            placeholder="Name and role of person spoken with"
            value={spokeWith}
            onChange={(e) => handleSpokeWithChange(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Existing contacts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Store Contacts
            </Label>
            <Button variant="outline" size="sm" onClick={addNewContact} className="h-7 gap-1">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>

          {loading ? (
            <div className="animate-pulse h-16 bg-muted rounded" />
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No contacts on file</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact, index) => (
                <div key={contact.id || index} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {contact.isNew ? (
                      <Input
                        placeholder="Name"
                        value={contact.name}
                        onChange={(e) => updateContact(index, 'name', e.target.value)}
                        className="h-7 text-sm flex-1"
                      />
                    ) : (
                      <span className="text-sm font-medium flex-1">{contact.name}</span>
                    )}
                    <Badge variant="outline" className="text-xs">{contact.role || 'Unknown'}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Phone number"
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      className="h-7 text-sm flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateContact(index, 'responsiveByCall', !contact.responsiveByCall)}
                      className={cn(
                        'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors',
                        contact.responsiveByCall 
                          ? 'bg-green-500/10 border-green-500/30 text-green-600' 
                          : 'text-muted-foreground'
                      )}
                    >
                      {contact.responsiveByCall ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Call
                    </button>
                    <button
                      onClick={() => updateContact(index, 'responsiveByText', !contact.responsiveByText)}
                      className={cn(
                        'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors',
                        contact.responsiveByText 
                          ? 'bg-green-500/10 border-green-500/30 text-green-600' 
                          : 'text-muted-foreground'
                      )}
                    >
                      {contact.responsiveByText ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Text
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ChecklistSection>
  );
}
