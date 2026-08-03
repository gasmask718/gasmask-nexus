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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RELATIONSHIP_TYPES = [
  'Owner', 'Co-Owner', 'Manager', 'Assistant Manager', 'Worker / Employee',
  'Son', 'Daughter', 'Brother', 'Sister', 'Partner', 'Wholesaler', 'Driver', 'Other',
] as const;

function getRelationshipBadgeClasses(type: string | null | undefined): string {
  if (!type) return 'bg-muted text-muted-foreground';
  if (['Owner', 'Co-Owner'].includes(type)) return 'bg-green-500/15 text-green-700 border-green-500/30';
  if (['Manager', 'Assistant Manager'].includes(type)) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  if (['Worker / Employee'].includes(type)) return 'bg-muted text-muted-foreground';
  if (['Son', 'Daughter', 'Brother', 'Sister'].includes(type)) return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
  if (['Partner', 'Wholesaler', 'Driver'].includes(type)) return 'bg-purple-500/15 text-purple-700 border-purple-500/30';
  return 'bg-muted text-muted-foreground';
}

interface ContactInfo {
  id?: string;
  name: string;
  role: string;
  phone: string;
  responsiveByCall: boolean;
  responsiveByText: boolean;
  isNew?: boolean;
  relationship_type?: string | null;
  relationship_type_custom?: string | null;
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
        .is('deleted_at', null)
        .eq('store_id', storeId);

      if (data) {
        setContacts(data.map((c: any) => ({
          id: c.id,
          name: c.name || '',
          role: c.role || '',
          phone: c.phone || '',
          responsiveByCall: c.responsive_by_call || false,
          responsiveByText: c.responsive_by_text || false,
          relationship_type: c.relationship_type || null,
          relationship_type_custom: c.relationship_type_custom || null,
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

  const handleRelationshipChange = async (index: number, value: string) => {
    const updated = [...contacts];
    updated[index] = {
      ...updated[index],
      relationship_type: value,
      relationship_type_custom: value === 'Other' ? updated[index].relationship_type_custom : null,
    };
    setContacts(updated);
    onContactUpdate({ ...contactData, contacts: updated, spokeWith });

    // Save immediately if existing contact
    const contact = updated[index];
    if (contact.id) {
      await (supabase as any)
        .from('store_contacts')
        .update({
          relationship_type: value,
          relationship_type_custom: value === 'Other' ? contact.relationship_type_custom : null,
        })
        .eq('id', contact.id);
    }
  };

  const handleCustomRelationshipChange = async (index: number, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], relationship_type_custom: value };
    setContacts(updated);

    const contact = updated[index];
    if (contact.id) {
      await (supabase as any)
        .from('store_contacts')
        .update({ relationship_type_custom: value })
        .eq('id', contact.id);
    }
  };

  const handleSpokeWithChange = (value: string) => {
    setSpokeWith(value);
    onContactUpdate({ ...contactData, contacts, spokeWith: value });
  };

  const getDisplayLabel = (contact: ContactInfo) => {
    if (contact.relationship_type === 'Other') return contact.relationship_type_custom || 'Other';
    return contact.relationship_type || contact.role || 'Unknown';
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
                  {/* Name + Relationship badge */}
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
                    <Badge variant="outline" className={cn('text-xs', getRelationshipBadgeClasses(contact.relationship_type))}>
                      {getDisplayLabel(contact)}
                    </Badge>
                  </div>

                  {/* Relationship Type Dropdown */}
                  <div className="flex items-center gap-2">
                    <Select
                      value={contact.relationship_type || ''}
                      onValueChange={(val) => handleRelationshipChange(index, val)}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Relationship type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_TYPES.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contact.relationship_type === 'Other' && (
                      <Input
                        placeholder="Specify..."
                        value={contact.relationship_type_custom || ''}
                        onChange={(e) => handleCustomRelationshipChange(index, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                    )}
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
