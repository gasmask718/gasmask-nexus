import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEditableEntity } from '@/hooks/useEditableEntity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PaymentScoreBadge } from '@/components/company/PaymentScoreBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, MapPin, Phone, Mail, Store, Truck, User, Pencil, Loader2 } from 'lucide-react';

interface CompanyData {
  id: string;
  name: string;
  type: string;
  neighborhood?: string | null;
  default_city?: string | null;
  default_state?: string | null;
  boro?: string | null;
  default_phone?: string | null;
  default_email?: string | null;
  sells_flowers?: boolean;
  rpa_status?: string | null;
  payment_reliability_score?: number;
  payment_reliability_tier?: string;
}

interface CompanyHeaderEditableProps {
  company: CompanyData;
  onNavigateBack: () => void;
}

const typeLabels: Record<string, string> = {
  store: 'Store',
  wholesaler: 'Wholesaler',
  direct_customer: 'Direct Customer',
};

const typeBadgeColors: Record<string, string> = {
  store: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  wholesaler: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  direct_customer: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  store: <Store className="h-4 w-4" />,
  wholesaler: <Truck className="h-4 w-4" />,
  direct_customer: <User className="h-4 w-4" />,
};

export function CompanyHeaderEditable({ company, onNavigateBack }: CompanyHeaderEditableProps) {
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: company.name || '',
    type: company.type || 'store',
    neighborhood: company.neighborhood || '',
    default_city: company.default_city || '',
    default_state: company.default_state || '',
    boro: company.boro || '',
    default_phone: company.default_phone || '',
    default_email: company.default_email || '',
    sells_flowers: company.sells_flowers || false,
    rpa_status: company.rpa_status || 'none',
  });
  
  const { updateMultipleFields, isSaving } = useEditableEntity({
    entity: 'companies',
    entityId: company.id,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['company', company.id] });
    },
  });

  const handleOpenEdit = () => {
    setFormData({
      name: company.name || '',
      type: company.type || 'store',
      neighborhood: company.neighborhood || '',
      default_city: company.default_city || '',
      default_state: company.default_state || '',
      boro: company.boro || '',
      default_phone: company.default_phone || '',
      default_email: company.default_email || '',
      sells_flowers: company.sells_flowers || false,
      rpa_status: company.rpa_status || 'none',
    });
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    const updates: Record<string, { newValue: any; oldValue?: any }> = {};
    
    if (formData.name !== company.name) {
      updates.name = { newValue: formData.name, oldValue: company.name };
    }
    if (formData.type !== company.type) {
      updates.type = { newValue: formData.type, oldValue: company.type };
    }
    if (formData.neighborhood !== (company.neighborhood || '')) {
      updates.neighborhood = { newValue: formData.neighborhood || null, oldValue: company.neighborhood };
    }
    if (formData.default_city !== (company.default_city || '')) {
      updates.default_city = { newValue: formData.default_city || null, oldValue: company.default_city };
    }
    if (formData.default_state !== (company.default_state || '')) {
      updates.default_state = { newValue: formData.default_state || null, oldValue: company.default_state };
    }
    if (formData.boro !== (company.boro || '')) {
      updates.boro = { newValue: formData.boro || null, oldValue: company.boro };
    }
    if (formData.default_phone !== (company.default_phone || '')) {
      updates.default_phone = { newValue: formData.default_phone || null, oldValue: company.default_phone };
    }
    if (formData.default_email !== (company.default_email || '')) {
      updates.default_email = { newValue: formData.default_email || null, oldValue: company.default_email };
    }
    if (formData.sells_flowers !== (company.sells_flowers || false)) {
      updates.sells_flowers = { newValue: formData.sells_flowers, oldValue: company.sells_flowers };
    }
    if (formData.rpa_status !== (company.rpa_status || 'none')) {
      updates.rpa_status = { newValue: formData.rpa_status, oldValue: company.rpa_status };
    }

    if (Object.keys(updates).length > 0) {
      const success = await updateMultipleFields(updates);
      if (success) {
        setIsEditOpen(false);
      }
    } else {
      setIsEditOpen(false);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Company Info */}
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={onNavigateBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-3">
              {/* Name & Type Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <Badge className={typeBadgeColors[company.type] || 'bg-muted'}>
                  {typeIcons[company.type]}
                  <span className="ml-1">{typeLabels[company.type] || company.type}</span>
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleOpenEdit}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
              
              {/* Location Row */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {(company.default_city || company.neighborhood) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.neighborhood || company.default_city}
                    {(company.boro || company.default_state) && ` • ${company.boro || company.default_state}`}
                  </span>
                )}
                {company.default_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {company.default_phone}
                  </span>
                )}
                {company.default_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {company.default_email}
                  </span>
                )}
              </div>
              
              {/* Tags Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {company.sells_flowers && (
                  <Badge variant="secondary" className="bg-pink-500/10 text-pink-400 border-pink-500/30">
                    🌸 Sells Flowers
                  </Badge>
                )}
                {company.rpa_status === 'rpa' && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                    🚚 RPA Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right: Payment Reliability Score */}
          <div className="lg:w-64 shrink-0">
            <PaymentScoreBadge 
              score={company.payment_reliability_score || 50} 
              tier={company.payment_reliability_tier || 'middle'} 
            />
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Company Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="direct_customer">Direct Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Neighborhood</Label>
                <Input
                  id="neighborhood"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="boro">Boro</Label>
                <Input
                  id="boro"
                  value={formData.boro}
                  onChange={(e) => setFormData({ ...formData, boro: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="default_city">City</Label>
                <Input
                  id="default_city"
                  value={formData.default_city}
                  onChange={(e) => setFormData({ ...formData, default_city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_state">State</Label>
                <Input
                  id="default_state"
                  value={formData.default_state}
                  onChange={(e) => setFormData({ ...formData, default_state: e.target.value })}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              <Label htmlFor="default_phone">Phone</Label>
              <Input
                id="default_phone"
                value={formData.default_phone}
                onChange={(e) => setFormData({ ...formData, default_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_email">Email</Label>
              <Input
                id="default_email"
                type="email"
                value={formData.default_email}
                onChange={(e) => setFormData({ ...formData, default_email: e.target.value })}
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="sells_flowers">Sells Flowers</Label>
              <Switch
                id="sells_flowers"
                checked={formData.sells_flowers}
                onCheckedChange={(checked) => setFormData({ ...formData, sells_flowers: checked })}
              />
            </div>

            {/* RPA Status */}
            <div className="space-y-2">
              <Label>RPA Status</Label>
              <Select 
                value={formData.rpa_status} 
                onValueChange={(value) => setFormData({ ...formData, rpa_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="rpa">RPA Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
