import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { YelpSearchAutocomplete } from './YelpSearchAutocomplete';
import { LocationAutocomplete } from './LocationAutocomplete';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Search, Star, MapPin, Phone, Loader2, Download, ArrowLeft } from 'lucide-react';
import { YelpBusinessDetail } from './YelpBusinessDetail';
import { useSearchHistory } from '@/hooks/useSearchHistory';

interface YelpBusiness {
  id: string;
  name: string;
  image_url: string;
  url: string;
  review_count: number;
  rating: number;
  categories: { alias: string; title: string }[];
  phone: string;
  display_phone: string;
  location: {
    address1: string;
    address2: string;
    address3: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    display_address: string[];
  };
  coordinates: { latitude: number; longitude: number };
}

interface Props {
  onBack: () => void;
}

export function YelpBusinessSearch({ onBack }: Props) {
  const { addSearch, recentTerms, recentLocations } = useSearchHistory();
  const [term, setTerm] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<YelpBusiness[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const [detailBusiness, setDetailBusiness] = useState<YelpBusiness | null>(null);

  const handleSearch = async () => {
    if (!term || !location) {
      toast({ title: 'Missing Fields', description: 'Enter a search term and location.', variant: 'destructive' });
      return;
    }
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('yelp-business-search', {
        body: { action: 'search', term, location },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.businesses || []);
      if ((data?.businesses || []).length === 0) {
        toast({ title: 'No Results', description: 'No businesses found for that search.' });
      } else {
        addSearch(term, location);
      }
    } catch (err: any) {
      toast({ title: 'Search Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(b => b.id)));
  };

  const ingestSelected = async () => {
    const businesses = results.filter(b => selected.has(b.id));
    if (businesses.length === 0) return;
    setIngesting(true);
    try {
      const records = businesses.map(b => ({
        full_address: b.location.display_address.join(', '),
        city: b.location.city,
        state: b.location.state,
        zip: b.location.zip_code,
        latitude: b.coordinates.latitude,
        longitude: b.coordinates.longitude,
        address_type: 'commercial',
        notes: `${b.name} | ${b.categories.map(c => c.title).join(', ')} | Rating: ${b.rating}/5 (${b.review_count} reviews) | ${b.display_phone}`,
        discovery_status: 'unknown',
        discovered_by: 'yelp',
      }));

      // Dedup check
      const addresses = records.map(r => r.full_address);
      const { data: existing } = await supabase
        .from('territory_addresses')
        .select('full_address')
        .in('full_address', addresses);

      const existingSet = new Set((existing || []).map((e: any) => e.full_address));
      const newRecords = records.filter(r => !existingSet.has(r.full_address));

      if (newRecords.length === 0) {
        toast({ title: 'All Duplicates', description: 'All selected businesses already exist in your territory.' });
        setIngesting(false);
        return;
      }

      const { error } = await supabase.from('territory_addresses').insert(newRecords);
      if (error) throw error;

      toast({
        title: 'Ingestion Complete',
        description: `${newRecords.length} new address(es) added. ${records.length - newRecords.length} duplicates skipped.`,
      });
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIngesting(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
    ));
  };

  if (detailBusiness) {
    return (
      <YelpBusinessDetail
        business={detailBusiness}
        onBack={() => setDetailBusiness(null)}
        onIngest={async () => {
          setSelected(new Set([detailBusiness.id]));
          setDetailBusiness(null);
          // Small delay then trigger ingest
          setTimeout(() => {
            const btn = document.getElementById('yelp-ingest-btn');
            if (btn) btn.click();
          }, 100);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h3 className="text-lg font-semibold">Yelp Business Search</h3>
      </div>

      {/* Search form */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Business Name / Keyword</Label>
              <YelpSearchAutocomplete
                value={term}
                onChange={setTerm}
                onBusinessSelect={(b) => {
                  if (b.location?.city) {
                    const loc = b.location.state
                      ? `${b.location.city}, ${b.location.state}`
                      : b.location.city;
                    setLocation(loc);
                  }
                }}
                placeholder="e.g. Smoke Shop"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                searchHistory={recentTerms}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Location (City, State)</Label>
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="e.g. New York, NY"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                searchHistory={recentLocations}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} results found</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.size === results.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selected.size > 0 && (
                <Button
                  id="yelp-ingest-btn"
                  size="sm"
                  onClick={ingestSelected}
                  disabled={ingesting}
                >
                  {ingesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Ingest Selected ({selected.size})
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map(b => (
              <Card
                key={b.id}
                className={`cursor-pointer transition-colors hover:border-primary/40 ${selected.has(b.id) ? 'border-primary bg-primary/5' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex items-start pt-1">
                      <Checkbox
                        checked={selected.has(b.id)}
                        onCheckedChange={() => toggleSelect(b.id)}
                      />
                    </div>
                    {b.image_url && (
                      <img
                        src={b.image_url}
                        alt={b.name}
                        className="h-16 w-16 rounded-md object-cover shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 min-w-0" onClick={() => setDetailBusiness(b)}>
                      <p className="font-medium text-sm truncate">{b.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {renderStars(b.rating)}
                        <span className="text-xs text-muted-foreground ml-1">({b.review_count})</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.location.display_address.join(', ')}</span>
                      </div>
                      {b.display_phone && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{b.display_phone}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {b.categories.slice(0, 3).map(c => (
                          <Badge key={c.alias} variant="outline" className="text-[10px] px-1.5 py-0">
                            {c.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
