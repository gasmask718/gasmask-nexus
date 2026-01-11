import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTopTierDrivers, TopTierDriver } from '@/hooks/toptier/useTopTierDrivers';
import { 
  Plus, 
  Search, 
  Car, 
  UserCheck, 
  Clock, 
  Phone, 
  Mail,
  Star,
  Route,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriversModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriversModal({ open, onOpenChange }: DriversModalProps) {
  const { drivers, isLoading, createDriver, updateDriver, deleteDriver, isCreating } = useTopTierDrivers();
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<TopTierDriver | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    status: 'active' as const,
    duty_status: 'off_duty' as const,
    has_vehicle: false,
    vehicle_make: '',
    vehicle_model: '',
    vehicle_color: '',
    license_plate: '',
    intake_notes: '',
    admin_notes: '',
  });

  const filteredDrivers = drivers.filter(d => 
    d.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.phone?.includes(searchQuery) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDriver = () => {
    createDriver({
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone || null,
      email: formData.email || null,
      status: formData.status,
      duty_status: formData.duty_status,
      has_vehicle: formData.has_vehicle,
      vehicle_make: formData.vehicle_make || null,
      vehicle_model: formData.vehicle_model || null,
      vehicle_color: formData.vehicle_color || null,
      license_plate: formData.license_plate || null,
      intake_notes: formData.intake_notes || null,
      admin_notes: formData.admin_notes || null,
    });
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      status: 'active',
      duty_status: 'off_duty',
      has_vehicle: false,
      vehicle_make: '',
      vehicle_model: '',
      vehicle_color: '',
      license_plate: '',
      intake_notes: '',
      admin_notes: '',
    });
    setActiveTab('list');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'on_leave': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'terminated': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getDutyColor = (duty: string) => {
    switch (duty) {
      case 'on_duty': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'off_duty': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'break': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Car className="h-5 w-5 text-primary" />
            Drivers Management
          </DialogTitle>
          <DialogDescription>
            Manage your driver fleet, assignments, and vehicle information
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">All Drivers ({drivers.length})</TabsTrigger>
              <TabsTrigger value="add">Add Driver</TabsTrigger>
              <TabsTrigger value="details" disabled={!selectedDriver}>Driver Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="px-6 pb-6 mt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search drivers..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Driver List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading drivers...</p>
                ) : filteredDrivers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No drivers found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab('add')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Driver
                    </Button>
                  </div>
                ) : (
                  filteredDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      onClick={() => {
                        setSelectedDriver(driver);
                        setActiveTab('details');
                      }}
                      className="p-4 rounded-lg border bg-card/50 hover:bg-card cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {driver.first_name?.[0]}{driver.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{driver.full_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {driver.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {driver.phone}
                                </span>
                              )}
                              {driver.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {driver.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {driver.has_vehicle && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                              <Car className="h-3 w-3 mr-1" />
                              Has Vehicle
                            </Badge>
                          )}
                          <Badge variant="outline" className={getStatusColor(driver.status)}>
                            {driver.status}
                          </Badge>
                          <Badge variant="outline" className={getDutyColor(driver.duty_status)}>
                            <Clock className="h-3 w-3 mr-1" />
                            {driver.duty_status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add" className="px-6 pb-6 mt-4">
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duty Status</Label>
                    <Select 
                      value={formData.duty_status} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, duty_status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_duty">On Duty</SelectItem>
                        <SelectItem value="off_duty">Off Duty</SelectItem>
                        <SelectItem value="break">On Break</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Has Vehicle</Label>
                    <Switch
                      checked={formData.has_vehicle}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_vehicle: checked }))}
                    />
                  </div>
                  
                  {formData.has_vehicle && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_make">Make</Label>
                        <Input
                          id="vehicle_make"
                          value={formData.vehicle_make}
                          onChange={(e) => setFormData(prev => ({ ...prev, vehicle_make: e.target.value }))}
                          placeholder="Toyota"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_model">Model</Label>
                        <Input
                          id="vehicle_model"
                          value={formData.vehicle_model}
                          onChange={(e) => setFormData(prev => ({ ...prev, vehicle_model: e.target.value }))}
                          placeholder="Camry"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_color">Color</Label>
                        <Input
                          id="vehicle_color"
                          value={formData.vehicle_color}
                          onChange={(e) => setFormData(prev => ({ ...prev, vehicle_color: e.target.value }))}
                          placeholder="Black"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="license_plate">License Plate</Label>
                        <Input
                          id="license_plate"
                          value={formData.license_plate}
                          onChange={(e) => setFormData(prev => ({ ...prev, license_plate: e.target.value }))}
                          placeholder="ABC-1234"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="intake_notes">Intake Notes (copied word-for-word)</Label>
                  <Textarea
                    id="intake_notes"
                    value={formData.intake_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, intake_notes: e.target.value }))}
                    placeholder="Notes from intake..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_notes">Admin Notes</Label>
                  <Textarea
                    id="admin_notes"
                    value={formData.admin_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_notes: e.target.value }))}
                    placeholder="Internal admin notes..."
                    rows={3}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateDriver}
                  disabled={!formData.first_name || !formData.last_name || isCreating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreating ? 'Adding...' : 'Add Driver'}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="px-6 pb-6 mt-4">
            {selectedDriver && (
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">
                        {selectedDriver.first_name?.[0]}{selectedDriver.last_name?.[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedDriver.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getStatusColor(selectedDriver.status)}>
                          {selectedDriver.status}
                        </Badge>
                        <Badge variant="outline" className={getDutyColor(selectedDriver.duty_status)}>
                          {selectedDriver.duty_status.replace('_', ' ')}
                        </Badge>
                        {selectedDriver.has_vehicle && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                            <Car className="h-3 w-3 mr-1" />
                            Has Vehicle
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border bg-card/50 text-center">
                      <Star className="h-5 w-5 mx-auto text-amber-400 mb-1" />
                      <p className="text-2xl font-bold">{selectedDriver.rating?.toFixed(1) || '5.0'}</p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-card/50 text-center">
                      <Route className="h-5 w-5 mx-auto text-cyan-400 mb-1" />
                      <p className="text-2xl font-bold">{selectedDriver.total_trips || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Trips</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-card/50 text-center">
                      <UserCheck className="h-5 w-5 mx-auto text-green-400 mb-1" />
                      <p className="text-2xl font-bold capitalize">{selectedDriver.assignment_status}</p>
                      <p className="text-xs text-muted-foreground">Assignment</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Contact Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDriver.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDriver.email || 'No email'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Info */}
                  {selectedDriver.has_vehicle && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Vehicle Information
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Make/Model:</span>
                          <p>{selectedDriver.vehicle_make} {selectedDriver.vehicle_model}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Color:</span>
                          <p>{selectedDriver.vehicle_color || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">License Plate:</span>
                          <p>{selectedDriver.license_plate || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {(selectedDriver.intake_notes || selectedDriver.admin_notes) && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Notes</h4>
                      {selectedDriver.intake_notes && (
                        <div>
                          <span className="text-xs text-muted-foreground">Intake Notes:</span>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{selectedDriver.intake_notes}</p>
                        </div>
                      )}
                      {selectedDriver.admin_notes && (
                        <div className="mt-3">
                          <span className="text-xs text-muted-foreground">Admin Notes:</span>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{selectedDriver.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        updateDriver({ 
                          id: selectedDriver.id, 
                          duty_status: selectedDriver.duty_status === 'on_duty' ? 'off_duty' : 'on_duty' 
                        });
                      }}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Toggle Duty Status
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this driver?')) {
                          deleteDriver(selectedDriver.id);
                          setSelectedDriver(null);
                          setActiveTab('list');
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
