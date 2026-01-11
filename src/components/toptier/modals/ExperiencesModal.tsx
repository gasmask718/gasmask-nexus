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
import { useTopTierExperiences, TopTierExperience } from '@/hooks/toptier/useTopTierExperiences';
import { 
  Plus, 
  Search, 
  Sparkles,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Gift,
  Building2,
  Clock,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExperiencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: 'dining', label: 'Dining', icon: '🍽️' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎭' },
  { value: 'wellness', label: 'Wellness', icon: '🧘' },
  { value: 'adventure', label: 'Adventure', icon: '🏔️' },
  { value: 'cultural', label: 'Cultural', icon: '🎨' },
  { value: 'nightlife', label: 'Nightlife', icon: '🌙' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'general', label: 'General', icon: '✨' },
];

export function ExperiencesModal({ open, onOpenChange }: ExperiencesModalProps) {
  const { experiences, isLoading, createExperience, updateExperience, deleteExperience, isCreating } = useTopTierExperiences();
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExperience, setSelectedExperience] = useState<TopTierExperience | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general' as const,
    status: 'available' as const,
    availability: 'open' as const,
    is_partner_provided: false,
    partner_name: '',
    is_complimentary: false,
    price: '',
    location: '',
    duration_hours: '',
    max_guests: '',
    notes: '',
    special_requirements: '',
  });

  const filteredExperiences = experiences.filter(e => 
    e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateExperience = () => {
    createExperience({
      title: formData.title,
      description: formData.description || null,
      category: formData.category,
      status: formData.status,
      availability: formData.availability,
      is_partner_provided: formData.is_partner_provided,
      partner_name: formData.partner_name || null,
      is_complimentary: formData.is_complimentary,
      price: formData.price ? parseFloat(formData.price) : null,
      location: formData.location || null,
      duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
      max_guests: formData.max_guests ? parseInt(formData.max_guests) : null,
      notes: formData.notes || null,
      special_requirements: formData.special_requirements || null,
    });
    setFormData({
      title: '',
      description: '',
      category: 'general',
      status: 'available',
      availability: 'open',
      is_partner_provided: false,
      partner_name: '',
      is_complimentary: false,
      price: '',
      location: '',
      duration_hours: '',
      max_guests: '',
      notes: '',
      special_requirements: '',
    });
    setActiveTab('list');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'booked': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'completed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.icon || '✨';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Things To Do - Experiences
          </DialogTitle>
          <DialogDescription>
            Manage luxury experiences, events, and activities
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">All Experiences ({experiences.length})</TabsTrigger>
              <TabsTrigger value="add">Add Experience</TabsTrigger>
              <TabsTrigger value="details" disabled={!selectedExperience}>Details</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="px-6 pb-6 mt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search experiences..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Experience List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading experiences...</p>
                ) : filteredExperiences.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No experiences found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab('add')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Experience
                    </Button>
                  </div>
                ) : (
                  filteredExperiences.map((exp) => (
                    <div
                      key={exp.id}
                      onClick={() => {
                        setSelectedExperience(exp);
                        setActiveTab('details');
                      }}
                      className="p-4 rounded-lg border bg-card/50 hover:bg-card cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl">
                            {getCategoryIcon(exp.category)}
                          </div>
                          <div>
                            <p className="font-medium">{exp.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {exp.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {exp.location}
                                </span>
                              )}
                              {exp.duration_hours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {exp.duration_hours}h
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {exp.is_partner_provided && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                              <Building2 className="h-3 w-3 mr-1" />
                              Partner
                            </Badge>
                          )}
                          {exp.is_complimentary ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                              <Gift className="h-3 w-3 mr-1" />
                              Free
                            </Badge>
                          ) : exp.price && (
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                              <DollarSign className="h-3 w-3 mr-1" />
                              ${exp.price}
                            </Badge>
                          )}
                          <Badge variant="outline" className={getStatusColor(exp.status)}>
                            {exp.status}
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
                <div className="space-y-2">
                  <Label htmlFor="title">Experience Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Private Wine Tasting at XYZ Vineyard"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the experience..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="New York, NY"
                    />
                  </div>
                </div>

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
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Select 
                      value={formData.availability} 
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, availability: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="sold_out">Sold Out</SelectItem>
                        <SelectItem value="by_request">By Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Partner & Pricing */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Partner Provided</Label>
                    <Switch
                      checked={formData.is_partner_provided}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_partner_provided: checked }))}
                    />
                  </div>
                  
                  {formData.is_partner_provided && (
                    <div className="space-y-2">
                      <Label htmlFor="partner_name">Partner Name</Label>
                      <Input
                        id="partner_name"
                        value={formData.partner_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, partner_name: e.target.value }))}
                        placeholder="Partner company name"
                      />
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Complimentary</Label>
                    <Switch
                      checked={formData.is_complimentary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_complimentary: checked }))}
                    />
                  </div>
                  
                  {!formData.is_complimentary && (
                    <div className="space-y-2">
                      <Label htmlFor="price">Price ($)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration_hours">Duration (hours)</Label>
                    <Input
                      id="duration_hours"
                      type="number"
                      step="0.5"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: e.target.value }))}
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_guests">Max Guests</Label>
                    <Input
                      id="max_guests"
                      type="number"
                      value={formData.max_guests}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_guests: e.target.value }))}
                      placeholder="10"
                    />
                  </div>
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
                  onClick={handleCreateExperience}
                  disabled={!formData.title || isCreating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreating ? 'Adding...' : 'Add Experience'}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="px-6 pb-6 mt-4">
            {selectedExperience && (
              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-primary/20 flex items-center justify-center text-3xl">
                      {getCategoryIcon(selectedExperience.category)}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedExperience.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getStatusColor(selectedExperience.status)}>
                          {selectedExperience.status}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {selectedExperience.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {selectedExperience.description && (
                    <p className="text-muted-foreground">{selectedExperience.description}</p>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedExperience.location && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedExperience.location}</span>
                      </div>
                    )}
                    {selectedExperience.duration_hours && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedExperience.duration_hours} hours</span>
                      </div>
                    )}
                    {selectedExperience.max_guests && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Max {selectedExperience.max_guests} guests</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-3 rounded-lg border">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedExperience.is_complimentary 
                          ? 'Complimentary' 
                          : selectedExperience.price 
                            ? `$${selectedExperience.price}` 
                            : 'Price TBD'}
                      </span>
                    </div>
                  </div>

                  {/* Partner Info */}
                  {selectedExperience.is_partner_provided && (
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-purple-400" />
                        <span className="font-medium">Partner Provided</span>
                      </div>
                      {selectedExperience.partner_name && (
                        <p className="text-sm text-muted-foreground">
                          Provided by: {selectedExperience.partner_name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {selectedExperience.notes && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedExperience.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        updateExperience({ 
                          id: selectedExperience.id, 
                          status: selectedExperience.status === 'available' ? 'booked' : 'available'
                        });
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Toggle Booking Status
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this experience?')) {
                          deleteExperience(selectedExperience.id);
                          setSelectedExperience(null);
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
