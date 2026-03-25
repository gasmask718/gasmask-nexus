import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PartyPopper, Search, Plus, MapPin, Star, Phone, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { usePipelineLeads } from './shared/usePipelineLeads';
import { PipelineLeadTable } from './shared/PipelineLeadTable';
import { PipelineStats } from './shared/PipelineStats';

const VENDOR_CATEGORIES = [
  'Event Halls', 'Party Rentals', 'Bartenders', 'Catering', 'DJs',
  'Photographers', 'Decorators', 'Clowns', 'Staffing Agencies',
  'Custom Items', 'Balloon Artists', 'Face Painters',
];

export default function UnforgettableTimesPipeline() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('Event Halls');
  const [location, setLocation] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats, addLead } = usePipelineLeads('Unforgettable Times', statusFilter === 'all' ? undefined : statusFilter);

  const searchVendors = async () => {
    if (!location) { toast.error('Enter a city or zip code'); return; }
    setSearching(true);
    try {
      const apiKey = (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY;
      if (!apiKey) { toast.error('Google Places API key not configured'); return; }
      const query = encodeURIComponent(`${category} in ${location}`);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) toast.info('No results found');
    } catch (e: any) {
      toast.error('Search failed: ' + e.message);
    } finally { setSearching(false); }
  };

  const addAsLead = async (place: any) => {
    setAddingIds(prev => new Set(prev).add(place.place_id));
    try {
      await addLead.mutateAsync({
        first_name: place.name,
        phone: place.formatted_phone_number || 'N/A',
        address: place.formatted_address || place.vicinity || '',
        lead_type: category,
        lead_source: 'google_places',
        metadata: { rating: place.rating, reviews: place.user_ratings_total, place_id: place.place_id },
      });
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(place.place_id); return s; });
    }
  };

  const addAllResults = async () => {
    for (const place of searchResults) {
      await addAsLead(place);
    }
    toast.success(`Added ${searchResults.length} vendors`);
  };

  const columns = [
    { key: 'name', label: 'Business', render: (l: any) => l.first_name || '—' },
    { key: 'lead_type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'rating', label: 'Rating', render: (l: any) => l.metadata?.rating ? `⭐ ${l.metadata.rating}` : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PartyPopper className="h-6 w-6 text-pink-500" /> Unforgettable Times Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">Find event vendors and partners — halls, caterers, DJs, decorators, photographers, and more</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500">Internal</Badge>
          <span className="text-xs text-muted-foreground">Calls as: Unforgettable Times USA</span>
        </div>
      </div>

      {/* Google Places Vendor Search */}
      <Card className="border-pink-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Find Vendors (Google Places)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENDOR_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="City or Zip Code" value={location} onChange={e => setLocation(e.target.value)} />
            <Button onClick={searchVendors} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Search Vendors
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{searchResults.length} results</p>
                <Button size="sm" variant="outline" onClick={addAllResults}>
                  <Plus className="h-3 w-3 mr-1" /> Add All
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {searchResults.map((place: any) => (
                  <Card key={place.place_id} className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {place.formatted_address || place.vicinity}
                          </p>
                          {place.rating && (
                            <p className="text-xs text-amber-500 mt-1">
                              <Star className="h-3 w-3 inline" /> {place.rating} ({place.user_ratings_total} reviews)
                            </p>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0 ml-2"
                          onClick={() => addAsLead(place)} disabled={addingIds.has(place.place_id)}>
                          {addingIds.has(place.place_id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PipelineStats stats={stats} labels={{ booked: 'Active Partners', interested: 'Interested' }} />

      <PipelineLeadTable
        leads={leads}
        isLoading={isLoading}
        columns={columns}
        onUploadCSV={(file) => uploadCSV(file)}
        onSendToCampaign={(ids) => sendToCampaign.mutate(ids)}
        onRefetch={refetch}
        isSending={sendToCampaign.isPending}
        uploadLabel="Upload Vendor List"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </div>
  );
}
