import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X, Plus, User, Phone, Mail, Store, Tag, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandKey: string;
  brandLabel: string;
  brandColor: string;
  accounts: any[];
}

const DEFAULT_ROLES = [
  { name: 'Owner', color: '#EF4444' },
  { name: 'Manager', color: '#3B82F6' },
  { name: 'Buyer', color: '#10B981' },
  { name: 'Assistant', color: '#8B5CF6' },
  { name: 'Accounting', color: '#F59E0B' },
  { name: 'Marketing', color: '#EC4899' },
  { name: 'Decision Maker', color: '#6366F1' },
  { name: 'Other', color: '#6B7280' },
];

export function AddContactModal({ 
  open, 
  onOpenChange, 
  brandKey, 
  brandLabel, 
  brandColor,
  accounts 
}: AddContactModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  
  // Form state
  const [formData, setFormData] = useState({
    contactName: '',
    phone: '',
    email: '',
    primaryRole: 'Other',
    additionalRoles: [] as string[],
    linkedStores: [] as string[],
    notes: '',
    isPrimaryContact: false,
  });

  // Fetch custom roles on mount
  useEffect(() => {
    const fetchCustomRoles = async () => {
      const { data } = await supabase
        .from('custom_contact_roles')
        .select('role_name, color')
        .or(`brand.is.null,brand.eq.${brandLabel}`);
      
      if (data && data.length > 0) {
        const customRoles = data.map(r => ({ name: r.role_name, color: r.color || '#6B7280' }));
        // Merge with defaults, avoiding duplicates
        const allRoles = [...DEFAULT_ROLES];
        customRoles.forEach(cr => {
          if (!allRoles.find(r => r.name.toLowerCase() === cr.name.toLowerCase())) {
            allRoles.push(cr);
          }
        });
        setAvailableRoles(allRoles);
      }
    };
    
    if (open) {
      fetchCustomRoles();
    }
  }, [open, brandLabel]);

  const resetForm = () => {
    setFormData({
      contactName: '',
      phone: '',
      email: '',
      primaryRole: 'Other',
      additionalRoles: [],
      linkedStores: [],
      notes: '',
      isPrimaryContact: false,
    });
    setCustomRoleInput('');
  };

  const handleAddCustomRole = async () => {
    if (!customRoleInput.trim()) return;
    
    const newRoleName = customRoleInput.trim();
    if (availableRoles.find(r => r.name.toLowerCase() === newRoleName.toLowerCase())) {
      toast({ title: 'Role already exists', variant: 'destructive' });
      return;
    }

    // Add to database
    const { error } = await supabase
      .from('custom_contact_roles')
      .insert({ role_name: newRoleName, brand: brandLabel });

    if (!error) {
      setAvailableRoles([...availableRoles, { name: newRoleName, color: '#6B7280' }]);
      setCustomRoleInput('');
      toast({ title: `Added role: ${newRoleName}` });
    }
  };

  const toggleAdditionalRole = (role: string) => {
    if (role === formData.primaryRole) return;
    
    setFormData(prev => ({
      ...prev,
      additionalRoles: prev.additionalRoles.includes(role)
        ? prev.additionalRoles.filter(r => r !== role)
        : [...prev.additionalRoles, role]
    }));
  };

  const toggleLinkedStore = (storeId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedStores: prev.linkedStores.includes(storeId)
        ? prev.linkedStores.filter(s => s !== storeId)
        : [...prev.linkedStores, storeId]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.contactName.trim()) {
      toast({ title: 'Contact name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('[AddContact] Starting contact creation...');
      
      // Get or create a store_brand_account to link to
      let storeBrandAccountId: string | null = null;
      
      if (formData.linkedStores.length > 0) {
        // Use the first linked store's brand account
        const linkedAccount = accounts.find(a => a.store_master_id === formData.linkedStores[0]);
        if (linkedAccount) {
          storeBrandAccountId = linkedAccount.id;
        }
      }
      
      // If no linked store, create or find a default account
      if (!storeBrandAccountId && accounts.length > 0) {
        storeBrandAccountId = accounts[0].id;
      }

      // Auto-heal: If no accounts exist, try to create one
      if (!storeBrandAccountId) {
        console.log('[AddContact] No store_brand_account found, attempting auto-heal...');
        
        // Get any store_master record
        const { data: anyStore } = await supabase
          .from('store_master')
          .select('id')
          .limit(1)
          .single();
        
        if (anyStore) {
          // Use type assertion to handle strict typing
          const insertData = {
            store_master_id: anyStore.id,
            brand: brandLabel as 'GasMask' | 'GrabbaRUs' | 'HotMama' | 'HotScalati',
            active_status: true,
            loyalty_level: 'Bronze' as const,
            credit_terms: 'COD' as const,
            total_spent: 0
          };
          
          const { data: newAccount, error: createError } = await supabase
            .from('store_brand_accounts')
            .insert([insertData])
            .select('id')
            .single();
          
          if (createError) {
            console.error('[AddContact] Auto-heal failed:', createError);
            throw new Error('Failed to create brand account');
          }
          
          storeBrandAccountId = newAccount?.id || null;
          toast({ title: 'Repaired missing linkage. Contact saved.' });
        }
      }

      if (!storeBrandAccountId) {
        throw new Error('No store_brand_account available. Please add stores first.');
      }

      // Create the contact
      const { data: contact, error: contactError } = await supabase
        .from('brand_crm_contacts')
        .insert({
          store_brand_account_id: storeBrandAccountId,
          brand: brandLabel as any,
          contact_name: formData.contactName.trim(),
          contact_phone: formData.phone.trim() || null,
          contact_email: formData.email.trim() || null,
          primary_role: formData.primaryRole.toLowerCase().replace(/ /g, '_'),
          additional_roles: formData.additionalRoles.map(r => r.toLowerCase().replace(/ /g, '_')),
          notes: formData.notes.trim() || null,
          is_primary_contact: formData.isPrimaryContact,
          tags: [formData.primaryRole, ...formData.additionalRoles],
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('[AddContact] Contact creation failed:', contactError);
        throw contactError;
      }

      console.log('[AddContact] Contact created:', contact?.id);

      // Create store links
      if (contact?.id && formData.linkedStores.length > 0) {
        const storeLinks = formData.linkedStores.map(storeId => ({
          contact_id: contact.id,
          store_master_id: storeId,
          brand: brandLabel,
        }));

        const { error: linksError } = await supabase
          .from('brand_contact_store_links')
          .insert(storeLinks);

        if (linksError) {
          console.error('[AddContact] Store links creation failed:', linksError);
          // Don't throw - contact was created successfully
        } else {
          console.log('[AddContact] Created', storeLinks.length, 'store links');
        }
      }

      // Success
      toast({ title: `Contact "${formData.contactName}" added successfully` });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['brand-crm-contacts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-contact-store-links', brandKey] });
      
      resetForm();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('[AddContact] Error:', error);
      toast({ 
        title: 'Failed to add contact', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleColor = (roleName: string) => {
    return availableRoles.find(r => r.name === roleName)?.color || '#6B7280';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" style={{ color: brandColor }} />
            Add Contact to {brandLabel}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName" className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Contact Name *
                  </Label>
                  <Input
                    id="contactName"
                    placeholder="John Doe"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@store.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Primary Role */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> Primary Role
              </Label>
              <Select 
                value={formData.primaryRole} 
                onValueChange={(val) => setFormData({ 
                  ...formData, 
                  primaryRole: val,
                  additionalRoles: formData.additionalRoles.filter(r => r !== val)
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: role.color }} 
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Additional Roles */}
            <div className="space-y-2">
              <Label>Additional Roles</Label>
              <div className="flex flex-wrap gap-2">
                {availableRoles
                  .filter(r => r.name !== formData.primaryRole)
                  .map((role) => (
                    <Badge
                      key={role.name}
                      variant={formData.additionalRoles.includes(role.name) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      style={formData.additionalRoles.includes(role.name) ? { 
                        backgroundColor: role.color, 
                        color: 'white',
                        borderColor: role.color 
                      } : {}}
                      onClick={() => toggleAdditionalRole(role.name)}
                    >
                      {role.name}
                    </Badge>
                  ))}
              </div>
              
              {/* Add Custom Role */}
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add custom role..."
                  value={customRoleInput}
                  onChange={(e) => setCustomRoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRole()}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={handleAddCustomRole}
                  disabled={!customRoleInput.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Linked Stores */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Store className="w-3 h-3" /> Linked Stores
              </Label>
              {accounts.length > 0 ? (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {accounts.map((account) => (
                    <div 
                      key={account.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 border-b last:border-b-0"
                    >
                      <Checkbox
                        id={`store-${account.id}`}
                        checked={formData.linkedStores.includes(account.store_master_id)}
                        onCheckedChange={() => toggleLinkedStore(account.store_master_id)}
                      />
                      <label 
                        htmlFor={`store-${account.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {account.store_master?.store_name || 'Unknown Store'}
                        <span className="text-muted-foreground ml-2">
                          {account.store_master?.city}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                  No stores available. Build CRM links first.
                </div>
              )}
              
              {formData.linkedStores.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.linkedStores.map((storeId) => {
                    const store = accounts.find(a => a.store_master_id === storeId);
                    return (
                      <Badge key={storeId} variant="secondary" className="gap-1">
                        {store?.store_master?.store_name || 'Store'}
                        <X 
                          className="w-3 h-3 cursor-pointer" 
                          onClick={() => toggleLinkedStore(storeId)} 
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-1">
                <FileText className="w-3 h-3" /> Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this contact..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Primary Contact Toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPrimary"
                checked={formData.isPrimaryContact}
                onCheckedChange={(checked) => setFormData({ ...formData, isPrimaryContact: !!checked })}
              />
              <Label htmlFor="isPrimary" className="cursor-pointer">
                Mark as primary contact for {brandLabel}
              </Label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !formData.contactName.trim()}
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
