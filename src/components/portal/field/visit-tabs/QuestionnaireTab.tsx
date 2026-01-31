import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, X, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// Simplified questionnaire without clothing (moved to contacts) and without preset wholesalers
interface Questionnaire {
  storeCount: number;
  secureLevel: 'low' | 'medium' | 'high';
  sellsFlowers: boolean;
  interestedInCleaning: boolean;
}

interface WholesalerContact {
  id?: string;
  name: string;
  address: string;
  phone: string;
}

interface QuestionnaireTabProps {
  questionnaire: Questionnaire & { wholesalers?: string[]; clothingSize?: string };
  onQuestionnaireChange: (questionnaire: Questionnaire & { wholesalers?: string[]; clothingSize?: string }) => void;
  wholesalerContacts?: WholesalerContact[];
  onWholesalerContactsChange?: (contacts: WholesalerContact[]) => void;
}

export function QuestionnaireTab({ 
  questionnaire, 
  onQuestionnaireChange,
  wholesalerContacts = [],
  onWholesalerContactsChange,
}: QuestionnaireTabProps) {
  const [showAddWholesaler, setShowAddWholesaler] = useState(false);
  const [newWholesaler, setNewWholesaler] = useState<WholesalerContact>({
    name: '',
    address: '',
    phone: '',
  });

  const update = (updates: Partial<Questionnaire>) => {
    // Only update the simplified fields, exclude deprecated wholesalers/clothingSize arrays
    const { wholesalers, clothingSize, ...rest } = questionnaire;
    onQuestionnaireChange({ ...rest, ...updates });
  };

  const addWholesalerContact = () => {
    if (!newWholesaler.name.trim()) return;
    
    if (onWholesalerContactsChange) {
      onWholesalerContactsChange([...wholesalerContacts, { ...newWholesaler }]);
    }
    setNewWholesaler({ name: '', address: '', phone: '' });
    setShowAddWholesaler(false);
  };

  const removeWholesalerContact = (index: number) => {
    if (onWholesalerContactsChange) {
      onWholesalerContactsChange(wholesalerContacts.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Questionnaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Store Questionnaire
          </CardTitle>
          <CardDescription>
            Gather essential information about the store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Store Count */}
          <div className="space-y-2">
            <Label>How many stores do they have?</Label>
            <Input
              type="number"
              min={1}
              value={questionnaire.storeCount}
              onChange={(e) => update({ storeCount: parseInt(e.target.value) || 1 })}
              className="w-32"
            />
          </div>

          {/* Security Level */}
          <div className="space-y-2">
            <Label>Security Level</Label>
            <Select
              value={questionnaire.secureLevel}
              onValueChange={(value) => update({ secureLevel: value as 'low' | 'medium' | 'high' })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sells Flowers */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label>Do they sell flowers?</Label>
              <p className="text-sm text-muted-foreground">Indicates if the store sells flower products</p>
            </div>
            <Switch
              checked={questionnaire.sellsFlowers}
              onCheckedChange={(checked) => update({ sellsFlowers: checked })}
            />
          </div>

          {/* Interested in Cleaning */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label>Interested in cleaning service?</Label>
              <p className="text-sm text-muted-foreground">Would they like iClean services?</p>
            </div>
            <Switch
              checked={questionnaire.interestedInCleaning}
              onCheckedChange={(checked) => update({ interestedInCleaning: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Wholesaler Contacts - Contact-Based Model */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Wholesaler Contacts
              </CardTitle>
              <CardDescription>
                Add external suppliers this store purchases from
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowAddWholesaler(true)} 
              size="sm" 
              variant="outline"
              disabled={showAddWholesaler}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Wholesaler
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Wholesaler Form */}
          {showAddWholesaler && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">New Wholesaler Contact</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAddWholesaler(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Wholesaler Name *</Label>
                  <Input
                    value={newWholesaler.name}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, name: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={newWholesaler.address}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, address: e.target.value })}
                    placeholder="Full address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={newWholesaler.phone}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    type="tel"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddWholesaler(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={addWholesalerContact} disabled={!newWholesaler.name.trim()}>
                  Add Wholesaler
                </Button>
              </div>
            </div>
          )}

          {/* List of Wholesaler Contacts */}
          {wholesalerContacts.length === 0 && !showAddWholesaler ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No wholesaler contacts added yet.</p>
              <p className="text-xs mt-1">Add the suppliers this store purchases from.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wholesalerContacts.map((contact, index) => (
                <div 
                  key={contact.id || index} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{contact.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {contact.address && <span>{contact.address}</span>}
                      {contact.phone && <span>• {contact.phone}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeWholesalerContact(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Info about clothing */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Clothing sizes moved to Contacts</p>
              <p className="text-xs">Shirt sizes are now tracked per contact in the Contacts tab.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
