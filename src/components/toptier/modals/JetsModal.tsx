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
import { useTopTierJets, TopTierJet } from '@/hooks/toptier/useTopTierJets';
import { 
  Plus, 
  Search, 
  Plane,
  PlaneTakeoff,
  MapPin,
  Users,
  DollarSign,
  Building2,
  Gauge,
  X,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface JetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JET_TYPES = [
  { value: 'light', label: 'Light Jet', passengers: '4-6' },
  { value: 'midsize', label: 'Midsize Jet', passengers: '6-8' },
  { value: 'super_midsize', label: 'Super Midsize', passengers: '8-10' },
  { value: 'heavy', label: 'Heavy Jet', passengers: '10-16' },
  { value: 'ultra_long_range', label: 'Ultra Long Range', passengers: '14-19' },
];

export function JetsModal({ open, onOpenChange }: JetsModalProps) {
  const { jets, isLoading, createJet, updateJet, deleteJet, isCreating } = useTopTierJets();
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJet, setSelectedJet] = useState<TopTierJet | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tail_number: '',
    jet_type: 'midsize' as const,
    manufacturer: '',
    model: '',
    year: '',
    status: 'available' as const,
    is_partner_jet: false,
    partner_name: '',
    passenger_capacity: '',
    range_nautical_miles: '',
    base_location: '',
    hourly_rate: '',
    daily_rate: '',
    notes: '',
  });

  const filteredJets = jets.filter(j => 
    j.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.tail_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateJet = () => {
    createJet({
      name: formData.name,
      tail_number: formData.tail_number || null,
      jet_type: formData.jet_type,
      manufacturer: formData.manufacturer || null,
      model: formData.model || null,
      year: formData.year ? parseInt(formData.year) : null,
      status: formData.status,
      is_partner_jet: formData.is_partner_jet,
      partner_name: formData.partner_name || null,
      passenger_capacity: formData.passenger_capacity ? parseInt(formData.passenger_capacity) : null,
      range_nautical_miles: formData.range_nautical_miles ? parseInt(formData.range_nautical_miles) : null,
      base_location: formData.base_location || null,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
      notes: formData.notes || null,
    });
    setFormData({
      name: '',
      tail_number: '',
      jet_type: 'midsize',
      manufacturer: '',
      model: '',
      year: '',
      status: 'available',
      is_partner_jet: false,
      partner_name: '',
      passenger_capacity: '',
      range_nautical_miles: '',
      base_location: '',
      hourly_rate: '',
      daily_rate: '',
      notes: '',
    });
    setActiveTab('list');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'booked': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'maintenance': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'in_transit': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'grounded': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getJetTypeLabel = (type: string | null) => {
    return JET_TYPES.find(t => t.value === type)?.label || type || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plane className="h-5 w-5 text-primary" />
            Private Jet Fleet
          </DialogTitle>
          <DialogDescription>
            Manage your private jet fleet and charter access
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">All Jets ({jets.length})</TabsTrigger>
              <TabsTrigger value="add">Add Jet</TabsTrigger>
              <TabsTrigger value="details" disabled={!selectedJet}>Jet Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="px-6 pb-6 mt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search jets..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Jet List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading jets...</p>
                ) : filteredJets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No jets found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab('add')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Jet
                    </Button>
                  </div>
                ) : (
                  filteredJets.map((jet) => (
                    <div
                      key={jet.id}
                      onClick={() => {
                        setSelectedJet(jet);
                        setActiveTab('details');
                      }}
                      className="p-4 rounded-lg border bg-card/50 hover:bg-card cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Plane className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{jet.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {jet.tail_number && (
                                <span>{jet.tail_number}</span>
                              )}
                              {jet.manufacturer && jet.model && (
                                <span>• {jet.manufacturer} {jet.model}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {getJetTypeLabel(jet.jet_type)}
                          </Badge>
                          {jet.is_partner_jet && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                              <Building2 className="h-3 w-3 mr-1" />
                              Partner
                            </Badge>
                          )}
                          <Badge variant="outline" className={getStatusColor(jet.status)}>
                            {jet.status}
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
                    <Label htmlFor="name">Jet Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Dynasty One"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tail_number">Tail Number</Label>
                    <Input
                      id="tail_number"
                      value={formData.tail_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, tail_number: e.target.value }))}
                      placeholder="N123AB"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                      placeholder="Gulfstream"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="G650"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                      placeholder="2023"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jet Type</Label>
                    <Select 
                      value={formData.jet_type} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, jet_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JET_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label} ({type.passengers} pax)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="in_transit">In Transit</SelectItem>
                        <SelectItem value="grounded">Grounded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="passenger_capacity">Passengers</Label>
                    <Input
                      id="passenger_capacity"
                      type="number"
                      value={formData.passenger_capacity}
                      onChange={(e) => setFormData(prev => ({ ...prev, passenger_capacity: e.target.value }))}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="range_nautical_miles">Range (nm)</Label>
                    <Input
                      id="range_nautical_miles"
                      type="number"
                      value={formData.range_nautical_miles}
                      onChange={(e) => setFormData(prev => ({ ...prev, range_nautical_miles: e.target.value }))}
                      placeholder="7000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="base_location">Base Location</Label>
                    <Input
                      id="base_location"
                      value={formData.base_location}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_location: e.target.value }))}
                      placeholder="KTEB"
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                      placeholder="15000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily_rate">Daily Rate ($)</Label>
                    <Input
                      id="daily_rate"
                      type="number"
                      value={formData.daily_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, daily_rate: e.target.value }))}
                      placeholder="75000"
                    />
                  </div>
                </div>

                {/* Partner */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Partner Jet</Label>
                    <Switch
                      checked={formData.is_partner_jet}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_partner_jet: checked }))}
                    />
                  </div>
                  
                  {formData.is_partner_jet && (
                    <div className="space-y-2">
                      <Label htmlFor="partner_name">Partner Name</Label>
                      <Input
                        id="partner_name"
                        value={formData.partner_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, partner_name: e.target.value }))}
                        placeholder="Partner company"
                      />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Internal notes..."
                    rows={3}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateJet}
                  disabled={!formData.name || isCreating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreating ? 'Adding...' : 'Add Jet'}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="px-6 pb-6 mt-4">
            {selectedJet && (
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Plane className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedJet.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {selectedJet.tail_number && <span>{selectedJet.tail_number}</span>}
                        {selectedJet.manufacturer && selectedJet.model && (
                          <span>• {selectedJet.manufacturer} {selectedJet.model} {selectedJet.year}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getStatusColor(selectedJet.status)}>
                          {selectedJet.status}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {getJetTypeLabel(selectedJet.jet_type)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedJet.passenger_capacity && (
                      <div className="flex items-center gap-3 p-4 rounded-lg border">
                        <Users className="h-5 w-5 text-cyan-400" />
                        <div>
                          <p className="text-2xl font-bold">{selectedJet.passenger_capacity}</p>
                          <p className="text-xs text-muted-foreground">Passengers</p>
                        </div>
                      </div>
                    )}
                    {selectedJet.range_nautical_miles && (
                      <div className="flex items-center gap-3 p-4 rounded-lg border">
                        <Gauge className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="text-2xl font-bold">{selectedJet.range_nautical_miles.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Range (nm)</p>
                        </div>
                      </div>
                    )}
                    {selectedJet.hourly_rate && (
                      <div className="flex items-center gap-3 p-4 rounded-lg border">
                        <DollarSign className="h-5 w-5 text-amber-400" />
                        <div>
                          <p className="text-2xl font-bold">${selectedJet.hourly_rate.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Hourly Rate</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-4 rounded-lg border">
                      <PlaneTakeoff className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="text-2xl font-bold">{selectedJet.total_charters}</p>
                        <p className="text-xs text-muted-foreground">Total Charters</p>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {(selectedJet.base_location || selectedJet.current_location) && (
                    <div className="border rounded-lg p-4 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedJet.base_location && (
                          <div>
                            <span className="text-muted-foreground">Base:</span>
                            <p>{selectedJet.base_location}</p>
                          </div>
                        )}
                        {selectedJet.current_location && (
                          <div>
                            <span className="text-muted-foreground">Current:</span>
                            <p>{selectedJet.current_location}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Partner Info */}
                  {selectedJet.is_partner_jet && (
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-purple-400" />
                        <span className="font-medium">Partner Jet</span>
                      </div>
                      {selectedJet.partner_name && (
                        <p className="text-sm text-muted-foreground">
                          Operated by: {selectedJet.partner_name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {selectedJet.notes && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedJet.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        updateJet({ 
                          id: selectedJet.id, 
                          status: selectedJet.status === 'available' ? 'maintenance' : 'available'
                        });
                      }}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Toggle Maintenance
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this jet?')) {
                          deleteJet(selectedJet.id);
                          setSelectedJet(null);
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
