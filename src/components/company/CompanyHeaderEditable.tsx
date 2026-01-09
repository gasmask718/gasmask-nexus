import { useQueryClient } from '@tanstack/react-query';
import { useEditableEntity } from '@/hooks/useEditableEntity';
import { EditableField } from '@/components/editing/EditableField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentScoreBadge } from '@/components/company/PaymentScoreBadge';
import { ArrowLeft, MapPin, Phone, Mail, Store, Truck, User } from 'lucide-react';

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

const typeOptions = [
  { value: 'store', label: 'Store' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'direct_customer', label: 'Direct Customer' },
];

const rpaOptions = [
  { value: 'none', label: 'None' },
  { value: 'rpa', label: 'RPA Active' },
  { value: 'pending', label: 'Pending' },
];

export function CompanyHeaderEditable({ company, onNavigateBack }: CompanyHeaderEditableProps) {
  const queryClient = useQueryClient();
  
  const { updateField, isSaving } = useEditableEntity({
    entity: 'companies',
    entityId: company.id,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['company', company.id] });
    },
  });

  const handleSave = async (field: string, value: string | number | boolean | null) => {
    await updateField(field, value, (company as any)[field]);
  };

  return (
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
              <EditableField
                value={company.name}
                field="name"
                type="text"
                onSave={handleSave}
                className="text-2xl font-bold"
                inline
              />
              <EditableField
                value={company.type}
                field="type"
                type="dropdown"
                options={typeOptions}
                onSave={handleSave}
              />
            </div>
            
            {/* Location Row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 shrink-0" />
                <EditableField
                  value={company.neighborhood || ''}
                  field="neighborhood"
                  type="text"
                  onSave={handleSave}
                  placeholder="Neighborhood"
                  inline
                />
                <span className="mx-1">•</span>
                <EditableField
                  value={company.default_city || ''}
                  field="default_city"
                  type="text"
                  onSave={handleSave}
                  placeholder="City"
                  inline
                />
                <span className="mx-1">,</span>
                <EditableField
                  value={company.default_state || ''}
                  field="default_state"
                  type="text"
                  onSave={handleSave}
                  placeholder="State"
                  inline
                />
              </span>
              
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4 shrink-0" />
                <EditableField
                  value={company.default_phone || ''}
                  field="default_phone"
                  type="text"
                  onSave={handleSave}
                  placeholder="Phone"
                  inline
                />
              </span>
              
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4 shrink-0" />
                <EditableField
                  value={company.default_email || ''}
                  field="default_email"
                  type="text"
                  onSave={handleSave}
                  placeholder="Email"
                  inline
                />
              </span>
            </div>
            
            {/* Tags Row */}
            <div className="flex items-center gap-4 flex-wrap">
              <EditableField
                value={company.sells_flowers || false}
                field="sells_flowers"
                type="toggle"
                onSave={handleSave}
                label="🌸 Sells Flowers"
              />
              <EditableField
                value={company.rpa_status || 'none'}
                field="rpa_status"
                type="dropdown"
                options={rpaOptions}
                onSave={handleSave}
                label="🚚 RPA Status"
              />
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
  );
}
