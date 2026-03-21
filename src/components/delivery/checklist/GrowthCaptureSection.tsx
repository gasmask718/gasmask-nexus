import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Store, Plus, Trash2, Phone, MapPin, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { toast } from 'sonner';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

interface NewStoreCapture {
  contactPersonName: string;
  name: string;
  telephone: string;
  address: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  full_address: string;
  addressConfirmed: boolean;
}

interface GrowthCaptureSectionProps {
  storeId: string;
  personType?: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  growthData: Record<string, any>;
  onGrowthUpdate: (data: Record<string, any>) => void;
}

const emptyStore = (): NewStoreCapture => ({
  contactPersonName: '', name: '', telephone: '', address: '', street: '', city: '', state: '', zip: '', full_address: '', addressConfirmed: false,
});

export function GrowthCaptureSection({
  storeId,
  personType = 'drivers',
  isTaskCompleted,
  onToggleTask,
  progress,
  growthData,
  onGrowthUpdate,
}: GrowthCaptureSectionProps) {
  const tasks = getTasksByCategory('growth');
  const [newStores, setNewStores] = useState<NewStoreCapture[]>(
    (growthData.newStores || []).map((s: any) => ({ ...emptyStore(), ...s }))
  );
  const [sellsFlowers, setSellsFlowers] = useState<string>(
    growthData.sellsFlowers || 'unknown'
  );
  const [saving, setSaving] = useState(false);

  const addNewStore = () => {
    const updated = [...newStores, emptyStore()];
    setNewStores(updated);
    onGrowthUpdate({ ...growthData, newStores: updated });
  };

  const updateNewStore = (index: number, field: keyof NewStoreCapture, value: any) => {
    const updated = [...newStores];
    updated[index] = { ...updated[index], [field]: value };
    setNewStores(updated);
    onGrowthUpdate({ ...growthData, newStores: updated });
  };

  const removeNewStore = (index: number) => {
    const updated = newStores.filter((_, i) => i !== index);
    setNewStores(updated);
    onGrowthUpdate({ ...growthData, newStores: updated });
  };

  const handleFlowersChange = (value: string) => {
    setSellsFlowers(value);
    onGrowthUpdate({ ...growthData, sellsFlowers: value });
  };

  const handleAddressSelect = (index: number, parsed: { street: string; city: string; state: string; zip: string; full_address: string }) => {
    const updated = [...newStores];
    updated[index] = {
      ...updated[index],
      street: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      full_address: parsed.full_address,
      address: parsed.street,
      addressConfirmed: true,
    };
    setNewStores(updated);
    onGrowthUpdate({ ...growthData, newStores: updated });
  };

  const clearAddress = (index: number) => {
    const updated = [...newStores];
    updated[index] = { ...updated[index], street: '', city: '', state: '', zip: '', full_address: '', address: '', addressConfirmed: false };
    setNewStores(updated);
    onGrowthUpdate({ ...growthData, newStores: updated });
  };

  const saveStoresToDb = async () => {
    const validStores = newStores.filter(s => s.name.trim());
    if (!validStores.length) {
      toast.info('No stores to save');
      return;
    }
    setSaving(true);
    try {
      for (const store of validStores) {
        await (supabase as any)
          .from('checklist_additional_stores')
          .insert({
            store_id: storeId,
            person_type: personType,
            contact_person_name: store.contactPersonName,
            store_name: store.name,
            telephone: store.telephone,
            address: store.full_address || store.address,
            street: store.street,
            city: store.city,
            state: store.state,
            zip: store.zip,
            full_address: store.full_address,
          });
      }
      toast.success(`${validStores.length} store(s) saved`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  return (
    <ChecklistSection
      title="Growth & Opportunities"
      icon={<Store className="h-5 w-5" />}
      category="growth"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      accentColor="text-emerald-500"
    >
      <div className="space-y-4">
        {/* Sells Flowers */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Do they sell flowers?
          </Label>
          <RadioGroup value={sellsFlowers} onValueChange={handleFlowersChange} className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="yes" id="flowers-yes" />
              <Label htmlFor="flowers-yes" className="text-sm cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="no" id="flowers-no" />
              <Label htmlFor="flowers-no" className="text-sm cursor-pointer">No</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="unknown" id="flowers-unknown" />
              <Label htmlFor="flowers-unknown" className="text-sm cursor-pointer">Unsure</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Additional Store Leads */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Additional Stores
            </Label>
            <Button variant="outline" size="sm" onClick={addNewStore} className="h-7 gap-1">
              <Plus className="h-3 w-3" /> Add Store
            </Button>
          </div>
          
          {newStores.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No additional stores captured yet</p>
          ) : (
            <div className="space-y-3">
              {newStores.map((store, index) => (
                <div key={index} className="p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Store #{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeNewStore(index)}
                      className="h-6 w-6 p-0 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Row 1: Name + Telephone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Store Name</Label>
                      <Input
                        placeholder="Store name"
                        value={store.name}
                        onChange={(e) => updateNewStore(index, 'name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> Telephone
                      </Label>
                      <Input
                        type="tel"
                        placeholder="(000) 000-0000"
                        value={store.telephone}
                        onChange={(e) => updateNewStore(index, 'telephone', formatPhone(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Row 2: Address autocomplete */}
                  {store.addressConfirmed ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Check className="h-3 w-3" />
                        <span className="truncate flex-1">{store.full_address}</span>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => clearAddress(index)}>
                          Change
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Street</Label>
                          <Input value={store.street} onChange={(e) => updateNewStore(index, 'street', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">City</Label>
                          <Input value={store.city} onChange={(e) => updateNewStore(index, 'city', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">State</Label>
                          <Input value={store.state} onChange={(e) => updateNewStore(index, 'state', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">ZIP</Label>
                          <Input value={store.zip} onChange={(e) => updateNewStore(index, 'zip', e.target.value)} className="h-7 text-xs" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> Address
                      </Label>
                      <AddressAutocomplete
                        value={store.address}
                        onChange={(val) => updateNewStore(index, 'address', val)}
                        onSelect={(parsed) => handleAddressSelect(index, parsed)}
                        placeholder="Search address..."
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={saveStoresToDb}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save All Stores'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ChecklistSection>
  );
}
