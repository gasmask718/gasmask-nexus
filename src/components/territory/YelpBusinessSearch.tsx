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
import { DuplicateResolutionModal, DuplicateRecord } from './DuplicateResolutionModal';
import { DataTablePagination } from '@/components/crud/DataTablePagination';

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

const PAGE_SIZE = 50;
const MAX_RESULTS = 300;

export function YelpBusinessSearch({ onBack }: Props) {
  const { addSearch, recentTerms, recentLocations } = useSearchHistory();
  const [term, setTerm] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<YelpBusiness[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const [detailBusiness, setDetailBusiness] = useState<YelpBusiness | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const [lastSearchLocation, setLastSearchLocation] = useState('');

  // Duplicate resolution state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateRecords, setDuplicateRecords] = useState<DuplicateRecord[]>([]);
  const [nonDuplicateRecords, setNonDuplicateRecords] = useState<any[]>([]);
  const [processingDuplicates, setProcessingDuplicates] = useState(false);

  const fetchPage = async (searchTerm: string, searchLocation: string, page: number) => {
    setSearching(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const { data, error } = await supabase.functions.invoke('yelp-business-search', {
        body: { action: 'search', term: searchTerm, location: searchLocation, limit: PAGE_SIZE, offset },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const businesses = data?.businesses || [];
      const total = Math.min(data?.total || 0, MAX_RESULTS);
      
      setResults(businesses);
      setTotalResults(total);
      setCurrentPage(page);
      
      return businesses.length;
    } catch (err: any) {
      toast({ title: 'Search Failed', description: err.message, variant: 'destructive' });
      return 0;
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!term || !location) {
      toast({ title: 'Missing Fields', description: 'Enter a search term and location.', variant: 'destructive' });
      return;
    }
    setResults([]);
    // Don't clear selections on new search — only clear current page selections
    setLastSearchTerm(term);
    setLastSearchLocation(location);
    
    const count = await fetchPage(term, location, 1);
    if (count === 0) {
      toast({ title: 'No Results', description: 'No businesses found for that search.' });
    } else {
      addSearch(term, location);
    }
  };

  const handlePageChange = async (page: number) => {
    await fetchPage(lastSearchTerm, lastSearchLocation, page);
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
    const currentIds = results.map(b => b.id);
    const allCurrentSelected = currentIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allCurrentSelected) {
        currentIds.forEach(id => next.delete(id));
      } else {
        currentIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const buildRecords = (businesses: YelpBusiness[]) =>
    businesses.map(b => ({
      store_name: b.name,
      full_address: b.location.display_address.join(', '),
      city: b.location.city,
      state: b.location.state,
      zip: b.location.zip_code,
      latitude: b.coordinates.latitude,
      longitude: b.coordinates.longitude,
      phone: b.phone || b.display_phone || null,
      address_type: 'commercial',
      notes: `${b.name} | ${b.categories.map(c => c.title).join(', ')} | Rating: ${b.rating}/5 (${b.review_count} reviews) | ${b.display_phone}`,
      discovery_status: 'unknown',
      discovered_by: 'yelp',
    }));

  const normalizeAddr = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

  const ingestSelected = async () => {
    const businesses = results.filter(b => selected.has(b.id));
    if (businesses.length === 0) return;
    setIngesting(true);
    try {
      const records = buildRecords(businesses);
      const addresses = records.map(r => r.full_address);

      // Run territory + store checks in parallel
      const [territoryResult, storesResult] = await Promise.all([
        supabase
          .from('territory_addresses')
          .select('id, full_address, notes, created_at')
          .in('full_address', addresses),
        supabase
          .from('stores')
          .select('id, name, address_street, address_city, address_state, address_zip, created_at')
          .is('deleted_at', null),
      ]);

      const existingTerritoryMap = new Map(
        (territoryResult.data || []).map((e: any) => [e.full_address, e])
      );

      // Build store lookup maps
      const storesByAddr = new Map<string, any>();
      const storesByName = new Map<string, any>();
      for (const store of (storesResult.data || [])) {
        const storeAddr = normalizeAddr(
          [store.address_street, store.address_city, store.address_state, store.address_zip]
            .filter(Boolean).join(', ')
        );
        if (storeAddr) storesByAddr.set(storeAddr, store);
        if (store.name) storesByName.set(store.name.toLowerCase(), store);
      }

      const dupes: DuplicateRecord[] = [];
      const fresh: typeof records = [];

      for (const rec of records) {
        // Check territory first
        const territoryMatch = existingTerritoryMap.get(rec.full_address);
        if (territoryMatch) {
          dupes.push({
            newRecord: rec,
            existingRow: { ...territoryMatch, source: 'territory' as const },
            action: 'skip',
          });
          continue;
        }

        // Check stores by address or name
        const recNormAddr = normalizeAddr(rec.full_address);
        const recName = rec.store_name?.toLowerCase() || '';
        const storeMatchByAddr = storesByAddr.get(recNormAddr);
        const storeMatchByName = recName ? storesByName.get(recName) : null;
        const storeMatch = storeMatchByAddr || storeMatchByName;

        if (storeMatch) {
          const storeFullAddr = [storeMatch.address_street, storeMatch.address_city, storeMatch.address_state, storeMatch.address_zip]
            .filter(Boolean).join(', ');
          dupes.push({
            newRecord: rec,
            existingRow: {
              id: storeMatch.id,
              full_address: storeFullAddr,
              notes: storeMatch.name,
              created_at: storeMatch.created_at || new Date().toISOString(),
              source: 'store_directory' as const,
            },
            action: 'skip',
          });
          continue;
        }

        fresh.push(rec);
      }

      if (dupes.length > 0) {
        setDuplicateRecords(dupes);
        setNonDuplicateRecords(fresh);
        setDuplicateModalOpen(true);
        setIngesting(false);
        return;
      }

      // No duplicates — insert directly
      if (fresh.length > 0) {
        const { error } = await supabase.from('territory_addresses').insert(fresh as any);
        if (error) throw error;
      }

      toast({
        title: 'Ingestion Complete',
        description: `${fresh.length} new address(es) added.`,
      });
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIngesting(false);
    }
  };

  const handleDuplicateConfirm = async (items: DuplicateRecord[]) => {
    setProcessingDuplicates(true);
    try {
      let inserted = 0;
      let updated = 0;
      let replaced = 0;
      let skipped = 0;

      for (const item of items) {
        const { action, newRecord, existingRow } = item;
        const source = existingRow.source || 'territory';

        if (action === 'skip') {
          skipped++;
          continue;
        }

        if (action === 'add') {
          const { error } = await supabase.from('territory_addresses').insert(newRecord as any);
          if (error) throw error;
          inserted++;
        }

        // Only allow update/replace for territory source
        if (action === 'update' && source === 'territory') {
          const { error } = await supabase
            .from('territory_addresses')
            .update({
              store_name: newRecord.store_name,
              latitude: newRecord.latitude,
              longitude: newRecord.longitude,
              phone: newRecord.phone || null,
              notes: newRecord.notes,
              discovered_by: newRecord.discovered_by,
            } as any)
            .eq('id', existingRow.id);
          if (error) throw error;
          updated++;
        }

        if (action === 'replace' && source === 'territory') {
          const { error: delErr } = await supabase
            .from('territory_addresses')
            .delete()
            .eq('id', existingRow.id);
          if (delErr) throw delErr;

          const { error: insErr } = await supabase.from('territory_addresses').insert(newRecord as any);
          if (insErr) throw insErr;
          replaced++;
        }
      }

      // Also insert non-duplicate records
      if (nonDuplicateRecords.length > 0) {
        const { error } = await supabase.from('territory_addresses').insert(nonDuplicateRecords as any);
        if (error) throw error;
        inserted += nonDuplicateRecords.length;
      }

      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} added`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (replaced > 0) parts.push(`${replaced} replaced`);
      if (skipped > 0) parts.push(`${skipped} skipped`);

      toast({
        title: 'Ingestion Complete',
        description: parts.join(', ') + '.',
      });

      setSelected(new Set());
      setDuplicateModalOpen(false);
      setDuplicateRecords([]);
      setNonDuplicateRecords([]);
    } catch (err: any) {
      toast({ title: 'Ingestion Failed', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingDuplicates(false);
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
          setTimeout(() => {
            const btn = document.getElementById('yelp-ingest-btn');
            if (btn) btn.click();
          }, 100);
        }}
      />
    );
  }

  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const currentPageSelectedCount = results.filter(b => selected.has(b.id)).length;
  const allCurrentSelected = results.length > 0 && currentPageSelectedCount === results.length;

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
            <p className="text-sm text-muted-foreground">
              Showing {results.length} of {totalResults} results
              {selected.size > 0 && ` · ${selected.size} selected total`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {allCurrentSelected ? 'Deselect Page' : 'Select Page'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              totalItems={totalResults}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      {/* Duplicate Resolution Modal */}
      <DuplicateResolutionModal
        open={duplicateModalOpen}
        duplicates={duplicateRecords}
        onConfirm={handleDuplicateConfirm}
        onCancel={() => {
          setDuplicateModalOpen(false);
          setDuplicateRecords([]);
          setNonDuplicateRecords([]);
        }}
        processing={processingDuplicates}
      />
    </div>
  );
}
