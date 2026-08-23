/**
 * PRODUCTION OFFICES MANAGEMENT PAGE
 * 
 * Admin-only page for creating, editing, and managing production offices.
 * Command overview showing health indicators for all offices.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout } from '@/components/portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useProductionOffices,
  useCreateOffice,
  useUpdateOffice,
  useDailyKPIs,
  ProductionOffice,
} from '@/hooks/useProductionPortal';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Clock, 
  Boxes,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  ArrowRight,
  Factory,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { InviteButton } from '@/components/invites/InviteButton';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-100 text-amber-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
];

interface OfficeFormData {
  name: string;
  location: string;
  address_line_1: string;
  city: string;
  state: string;
  zip_code: string;
  status: string;
  operating_hours_start: string;
  operating_hours_end: string;
}

const DEFAULT_FORM_DATA: OfficeFormData = {
  name: '',
  location: '',
  address_line_1: '',
  city: '',
  state: '',
  zip_code: '',
  status: 'active',
  operating_hours_start: '08:00',
  operating_hours_end: '18:00',
};

function OfficeHealthCard({ office }: { office: ProductionOffice }) {
  const navigate = useNavigate();
  const { data: kpis } = useDailyKPIs(office.id);
  
  const status = STATUS_OPTIONS.find(s => s.value === office.status) || STATUS_OPTIONS[0];
  const hasVarianceIssue = kpis && kpis.tubesVariance < -50;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              {office.name}
            </CardTitle>
            {office.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {office.location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasVarianceIssue && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Variance
              </Badge>
            )}
            <Badge className={cn(status.color)}>
              {office.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Boxes className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{kpis?.totalBoxes ?? 0}</p>
            <p className="text-xs text-muted-foreground">Boxes Today</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{kpis?.efficiencyPct?.toFixed(0) ?? 0}%</p>
            <p className="text-xs text-muted-foreground">Efficiency</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              {kpis?.isDayClosed ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="text-amber-600">Open</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">Day Status</p>
          </div>
        </div>
        
        {office.operating_hours && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Hours: {(office.operating_hours as any).start} - {(office.operating_hours as any).end}
          </p>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => navigate(`/portals/production?office=${office.id}`)}
          >
            Open Dashboard
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <InviteButton
            role="production"
            targetLink={{ office_id: office.id, office_name: office.name }}
            label="Invite Leader"
            variant="outline"
            size="sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function OfficeFormDialog({ 
  office, 
  open, 
  onOpenChange,
  onSuccess,
}: { 
  office?: ProductionOffice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const createOffice = useCreateOffice();
  const updateOffice = useUpdateOffice();
  
  const [formData, setFormData] = useState<OfficeFormData>(() => {
    if (office) {
      return {
        name: office.name,
        location: office.location || '',
        address_line_1: office.address_line_1 || '',
        city: office.city || '',
        state: office.state || '',
        zip_code: office.zip_code || '',
        status: office.status,
        operating_hours_start: (office.operating_hours as any)?.start || '08:00',
        operating_hours_end: (office.operating_hours as any)?.end || '18:00',
      };
    }
    return { ...DEFAULT_FORM_DATA };
  });
  
  const isEditing = !!office;
  const isLoading = createOffice.isPending || updateOffice.isPending;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      location: formData.location || null,
      address_line_1: formData.address_line_1 || null,
      city: formData.city || null,
      state: formData.state || null,
      zip_code: formData.zip_code || null,
      status: formData.status,
      operating_hours: {
        start: formData.operating_hours_start,
        end: formData.operating_hours_end,
      },
      active: formData.status !== 'closed',
    };
    
    try {
      if (isEditing && office) {
        await updateOffice.mutateAsync({ id: office.id, ...payload });
      } else {
        await createOffice.mutateAsync(payload);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Office' : 'Create Production Office'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the production office details.' 
              : 'Add a new production office to the Manufacturing OS.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Office Name *</Label>
            <Input 
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Bronx Production Office"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location Label</Label>
              <Input 
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g., Bronx, NY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <AddressAutocomplete
              id="address"
              value={formData.address_line_1}
              onChange={(val) => setFormData(f => ({ ...f, address_line_1: val }))}
              onSelect={(parsed) => setFormData(f => ({
                ...f,
                address_line_1: parsed.street,
                city: parsed.city,
                state: parsed.state,
                zip_code: parsed.zip,
              }))}
              placeholder="123 Main Street"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input 
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input 
                id="state"
                value={formData.state}
                onChange={(e) => setFormData(f => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input 
                id="zip"
                value={formData.zip_code}
                onChange={(e) => setFormData(f => ({ ...f, zip_code: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours_start">Operating Hours Start</Label>
              <Input 
                id="hours_start"
                type="time"
                value={formData.operating_hours_start}
                onChange={(e) => setFormData(f => ({ ...f, operating_hours_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours_end">Operating Hours End</Label>
              <Input 
                id="hours_end"
                type="time"
                value={formData.operating_hours_end}
                onChange={(e) => setFormData(f => ({ ...f, operating_hours_end: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Office'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OfficesManagementPage() {
  const navigate = useNavigate();
  const { data: offices = [], isLoading } = useProductionOffices();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<ProductionOffice | null>(null);

  const activeOffices = offices.filter(o => o.status === 'active');
  const maintenanceOffices = offices.filter(o => o.status === 'maintenance');
  const closedOffices = offices.filter(o => o.status === 'closed');

  return (
    <EnhancedPortalLayout
      title="Production Offices"
      subtitle="Manage all production facilities"
      portalIcon={<Factory className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'Dashboard', href: '/portals/production' },
      ]}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">All Offices</h2>
          <p className="text-sm text-muted-foreground">
            {activeOffices.length} active, {maintenanceOffices.length} maintenance, {closedOffices.length} closed
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Office
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : offices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Production Offices</h3>
            <p className="text-muted-foreground mb-4">
              Create your first production office to start tracking manufacturing operations.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Office
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active Offices */}
          {activeOffices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Active Offices ({activeOffices.length})
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeOffices.map(office => (
                  <OfficeHealthCard key={office.id} office={office} />
                ))}
              </div>
            </div>
          )}

          {/* Maintenance Offices */}
          {maintenanceOffices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4 text-amber-600" />
                Under Maintenance ({maintenanceOffices.length})
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maintenanceOffices.map(office => (
                  <OfficeHealthCard key={office.id} office={office} />
                ))}
              </div>
            </div>
          )}

          {/* Closed Offices */}
          {closedOffices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Closed ({closedOffices.length})
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {closedOffices.map(office => (
                  <OfficeHealthCard key={office.id} office={office} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <OfficeFormDialog 
        open={isCreateDialogOpen || !!editingOffice}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingOffice(null);
          }
        }}
        office={editingOffice}
      />
    </EnhancedPortalLayout>
  );
}
