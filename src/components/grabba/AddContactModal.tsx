import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X, Plus, User, Phone, Mail, Store, Briefcase, FileText, Search, MessageCircle, Sparkles, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandKey: string;
  brandLabel: string;
  brandColor: string;
  accounts: any[];
}

const DEFAULT_ROLES = [
  { name: 'Owner', color: 'hsl(0, 100%, 50%)' },
  { name: 'Manager', color: 'hsl(210, 100%, 50%)' },
  { name: 'Buyer', color: 'hsl(142, 76%, 36%)' },
  { name: 'Assistant', color: 'hsl(270, 100%, 60%)' },
  { name: 'Accounting', color: 'hsl(38, 92%, 50%)' },
  { name: 'Marketing', color: 'hsl(330, 100%, 60%)' },
  { name: 'Decision Maker', color: 'hsl(240, 100%, 60%)' },
  { name: 'Other', color: 'hsl(0, 0%, 50%)' },
];

const COMMUNICATION_METHODS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
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
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [storeSearch, setStoreSearch] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    contactName: '',
    phone: '',
    email: '',
    position: '',
    preferredComm: 'call',
    primaryRole: '',
    additionalRoles: [] as string[],
    linkedStores: [] as string[],
    notes: '',
    isPrimaryContact: false,
  });

  // Generate initials from name
  const initials = useMemo(() => {
    const parts = formData.contactName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
  }, [formData.contactName]);

  // Filter stores by search
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return accounts;
    const query = storeSearch.toLowerCase();
    return accounts.filter(a => 
      a.store_master?.store_name?.toLowerCase().includes(query) ||
      a.store_master?.city?.toLowerCase().includes(query) ||
      a.store_master?.state?.toLowerCase().includes(query)
    );
  }, [accounts, storeSearch]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return formData.contactName.trim().length > 0 && formData.primaryRole.length > 0;
  }, [formData.contactName, formData.primaryRole]);

  // Fetch custom roles on mount
  useEffect(() => {
    const fetchCustomRoles = async () => {
      const { data } = await supabase
        .from('custom_contact_roles')
        .select('role_name, color')
        .or(`brand.is.null,brand.eq.${brandLabel}`);
      
      if (data && data.length > 0) {
        const customRoles = data.map(r => ({ name: r.role_name, color: r.color || 'hsl(0, 0%, 50%)' }));
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
      position: '',
      preferredComm: 'call',
      primaryRole: '',
      additionalRoles: [],
      linkedStores: [],
      notes: '',
      isPrimaryContact: false,
    });
    setCustomRoleInput('');
    setShowCustomRoleInput(false);
    setStoreSearch('');
  };

  const handleAddCustomRole = async () => {
    if (!customRoleInput.trim()) return;
    
    const newRoleName = customRoleInput.trim();
    if (availableRoles.find(r => r.name.toLowerCase() === newRoleName.toLowerCase())) {
      toast({ title: 'Role already exists', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('custom_contact_roles')
      .insert({ role_name: newRoleName, brand: brandLabel });

    if (!error) {
      const newRole = { name: newRoleName, color: 'hsl(0, 0%, 50%)' };
      setAvailableRoles([...availableRoles, newRole]);
      setFormData(prev => ({ ...prev, additionalRoles: [...prev.additionalRoles, newRoleName] }));
      setCustomRoleInput('');
      setShowCustomRoleInput(false);
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
    if (!isFormValid) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('[AddContact] Starting contact creation...');
      
      let storeBrandAccountId: string | null = null;
      
      if (formData.linkedStores.length > 0) {
        const linkedAccount = accounts.find(a => a.store_master_id === formData.linkedStores[0]);
        if (linkedAccount) {
          storeBrandAccountId = linkedAccount.id;
        }
      }
      
      if (!storeBrandAccountId && accounts.length > 0) {
        storeBrandAccountId = accounts[0].id;
      }

      if (!storeBrandAccountId) {
        console.log('[AddContact] No store_brand_account found, attempting auto-heal...');
        
        const { data: anyStore } = await supabase
          .from('store_master')
          .select('id')
          .limit(1)
          .single();
        
        if (anyStore) {
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
        } else {
          console.log('[AddContact] Created', storeLinks.length, 'store links');
        }
      }

      toast({ 
        title: 'Contact added and linked successfully.',
        description: `${formData.contactName} has been added to ${brandLabel}.`
      });
      
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
    return availableRoles.find(r => r.name === roleName)?.color || 'hsl(0, 0%, 50%)';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0 bg-card border-border/50 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 bg-gradient-to-r from-card to-secondary/30">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-8 rounded-full" 
              style={{ backgroundColor: brandColor }}
            />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Add Brand Contact</h2>
              <p className="text-sm text-muted-foreground">Create a new contact for {brandLabel}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(92vh-180px)]">
          <div className="p-6 space-y-6">
            
            {/* SECTION 1: Identity Header */}
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 transition-all duration-300"
                  style={{ 
                    backgroundColor: formData.contactName ? brandColor : 'hsl(var(--muted))',
                    color: formData.contactName ? 'white' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  {formData.contactName ? initials : <User className="w-6 h-6" />}
                </div>
                
                {/* Name Input */}
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Contact's full name"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="text-lg h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
                  />
                  <p className="text-xs text-muted-foreground pl-1">Contact's full name (required)</p>
                </div>
              </div>
            </div>

            {/* SECTION 2: Communication Details */}
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-foreground">Communication Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pl-10 bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="contact@store.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10 bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Position / Title</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. Store Manager"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="pl-10 bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Preferred Communication</Label>
                    <Select 
                      value={formData.preferredComm} 
                      onValueChange={(val) => setFormData({ ...formData, preferredComm: val })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            <div className="flex items-center gap-2">
                              <method.icon className="w-4 h-4" />
                              {method.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Roles & Responsibilities */}
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-foreground">Roles & Responsibilities</h3>
              </div>
              
              {/* Primary Role */}
              <div className="space-y-3 mb-5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Primary Role (Required)</Label>
                <Select 
                  value={formData.primaryRole} 
                  onValueChange={(val) => setFormData({ 
                    ...formData, 
                    primaryRole: val,
                    additionalRoles: formData.additionalRoles.filter(r => r !== val)
                  })}
                >
                  <SelectTrigger className="bg-background/50 border-border/50 h-11">
                    <SelectValue placeholder="Select primary role..." />
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
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Additional Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {availableRoles
                    .filter(r => r.name !== formData.primaryRole)
                    .map((role) => {
                      const isSelected = formData.additionalRoles.includes(role.name);
                      return (
                        <button
                          key={role.name}
                          type="button"
                          onClick={() => toggleAdditionalRole(role.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
                            "border hover:scale-105 active:scale-95",
                            isSelected 
                              ? "border-transparent text-white shadow-md" 
                              : "border-border/50 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                          style={isSelected ? { backgroundColor: role.color } : {}}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {role.name}
                        </button>
                      );
                    })}
                </div>
                
                {/* Add Custom Role */}
                {showCustomRoleInput ? (
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Enter custom role name..."
                      value={customRoleInput}
                      onChange={(e) => setCustomRoleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRole()}
                      className="flex-1 bg-background/50 border-border/50"
                      autoFocus
                    />
                    <Button 
                      type="button" 
                      variant="default" 
                      size="sm"
                      onClick={handleAddCustomRole}
                      disabled={!customRoleInput.trim()}
                    >
                      Add
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setShowCustomRoleInput(false); setCustomRoleInput(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomRoleInput(true)}
                    className="mt-2 text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Custom Role
                  </button>
                )}
              </div>
            </div>

            {/* SECTION 4: Linked Stores */}
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-foreground">Linked Stores</h3>
              </div>
              
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search stores by name, city, or state..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50"
                />
              </div>

              {/* Selected Stores Pills */}
              {formData.linkedStores.length > 0 && (
                <div className="mb-3 p-3 bg-background/30 rounded-lg border border-border/20">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Linked to:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.linkedStores.map((storeId) => {
                      const store = accounts.find(a => a.store_master_id === storeId);
                      return (
                        <Badge 
                          key={storeId} 
                          variant="secondary" 
                          className="gap-1.5 py-1 px-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                        >
                          <Store className="w-3 h-3" />
                          {store?.store_master?.store_name || 'Store'}
                          <button
                            type="button"
                            onClick={() => toggleLinkedStore(storeId)}
                            className="ml-1 hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Store List */}
              {accounts.length > 0 ? (
                <div className="border border-border/30 rounded-lg overflow-hidden bg-background/30">
                  <ScrollArea className="max-h-40">
                    {filteredStores.map((account) => {
                      const isSelected = formData.linkedStores.includes(account.store_master_id);
                      return (
                        <div 
                          key={account.id}
                          onClick={() => toggleLinkedStore(account.store_master_id)}
                          className={cn(
                            "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-border/20 last:border-b-0",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {account.store_master?.store_name || 'Unknown Store'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {account.store_master?.city}{account.store_master?.state ? `, ${account.store_master.state}` : ''}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                      );
                    })}
                    {filteredStores.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No stores match your search
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-6 border border-dashed border-border/50 rounded-lg text-center">
                  <Store className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  No stores available. Build CRM links first.
                </div>
              )}
            </div>

            {/* SECTION 5: Internal Notes */}
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-foreground">Internal Notes</h3>
              </div>
              
              <Textarea
                placeholder="Important details, relationship notes, or special instructions…"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="bg-background/50 border-border/50 resize-none font-light text-muted-foreground placeholder:text-muted-foreground/50 leading-relaxed"
              />
            </div>

            {/* Primary Contact Toggle */}
            <div className="flex items-center gap-3 px-1">
              <Checkbox
                id="isPrimary"
                checked={formData.isPrimaryContact}
                onCheckedChange={(checked) => setFormData({ ...formData, isPrimaryContact: !!checked })}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label htmlFor="isPrimary" className="text-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                Set as primary contact for this brand
              </label>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-card flex items-center justify-between">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => { resetForm(); onOpenChange(false); }}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Contact'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
