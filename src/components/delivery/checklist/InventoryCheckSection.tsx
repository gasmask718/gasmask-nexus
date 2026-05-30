import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Package, Upload, X, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { VALID_TUBE_BRANDS } from '@/components/store/UnifiedTubeIntelligenceCard';

interface InventoryCheckSectionProps {
  storeId: string;
  personType?: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  inventoryData: Record<string, any>;
  onInventoryUpdate: (data: Record<string, any>) => void;
}

interface TubeProduct {
  id: string;
  brand_name: string;
  brand_id: string;
  current_tubes_left: number | null;
  last_order_date: string | null;
  needs_order: boolean;
}

export function InventoryCheckSection({
  storeId,
  personType = 'drivers',
  isTaskCompleted,
  onToggleTask,
  progress,
  inventoryData,
  onInventoryUpdate,
}: InventoryCheckSectionProps) {
  const tasks = getTasksByCategory('inventory');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingCounts, setSavingCounts] = useState(false);

  // Photo state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch products from store_tube_inventory_status (same source as Store Profile)
  const { data: tubeProducts = [] } = useQuery({
    queryKey: ['checklist-inventory-tube-products', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_tube_inventory_status')
        .select('id, brand_name, brand_id, current_tubes_left, last_order_date, needs_order')
        .eq('store_id', storeId)
        .eq('is_simulation', false)
        .order('brand_name');
      return (data || []) as TubeProduct[];
    },
    enabled: !!storeId,
  });

  // Use VALID_TUBE_BRANDS as fallback ordering, match by brand_id
  const orderedProducts = VALID_TUBE_BRANDS.map(vb => {
    const match = tubeProducts.find(tp => tp.brand_id === vb.id);
    return match || { id: vb.id, brand_name: vb.name, brand_id: vb.id, current_tubes_left: null, last_order_date: null, needs_order: false };
  });

  const isNewProduct = (brandId: string) => {
    const brand = VALID_TUBE_BRANDS.find(b => b.id === brandId);
    return brand && 'isNew' in brand && brand.isNew;
  };

  const handleCountChange = (productId: string, value: number) => {
    setCounts(prev => ({ ...prev, [productId]: value }));
  };

  const handleNoteChange = (productId: string, value: string) => {
    setNotes(prev => ({ ...prev, [productId]: value }));
  };

  const formatLastOrder = (date: string | null): string => {
    if (!date) return 'Never ordered';
    const d = new Date(date);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return `${format(d, 'MMM d, yyyy')} · ${days}d ago`;
  };

  const saveTubeCounts = async () => {
    setSavingCounts(true);
    try {
      const visitDate = new Date().toISOString().split('T')[0];
      const entries = orderedProducts
        .filter(p => counts[p.id] !== undefined && counts[p.id] > 0)
        .map(p => ({
          store_id: storeId,
          person_type: personType,
          product_id: p.id,
          product_name: p.brand_name,
          brand: p.brand_id,
          sku: '',
          count: counts[p.id] || 0,
          notes: notes[p.id] || null,
          visit_date: visitDate,
          updated_at: new Date().toISOString(),
        }));

      if (!entries.length) {
        toast.info('No counts to save');
        setSavingCounts(false);
        return;
      }

      const { error } = await (supabase as any)
        .from('checklist_tube_counts')
        .upsert(entries, { onConflict: 'store_id,person_type,product_id,visit_date' });
      if (error) throw error;
      toast.success(`${entries.length} tube count(s) saved`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save counts');
    } finally {
      setSavingCounts(false);
    }
  };

  // Photo handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setPreviews(prev => [...prev, url]);
    });
  };

  const removePreview = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviews([]);
  };

  const savePhotos = async () => {
    if (!selectedFiles.length) return;
    setSavingPhotos(true);
    try {
      const visitDate = new Date().toISOString().split('T')[0];
      for (const file of selectedFiles) {
        const fileName = `${storeId}/${personType}/${visitDate}/${Date.now()}-${file.name}`;
        const { data, error: upErr } = await supabase.storage
          .from('checklist-photos')
          .upload(fileName, file, { upsert: true });
        if (upErr) throw upErr;

        await (supabase as any)
          .from('checklist_inventory_photos')
          .insert({
            store_id: storeId,
            person_type: personType,
            file_path: data.path,
            file_name: file.name,
            visit_date: visitDate,
          });
      }
      toast.success(`${selectedFiles.length} photo(s) saved`);
      clearAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photos');
    } finally {
      setSavingPhotos(false);
    }
  };

  return (
    <ChecklistSection
      title="Inventory Verification"
      icon={<Package className="h-5 w-5" />}
      category="inventory"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      defaultExpanded={true}
      accentColor="text-amber-500"
    >
      <div className="space-y-4">
        {/* Tube Counts — Per Product from store_tube_inventory_status */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tube Counts per Product
          </Label>
          <div className="space-y-2">
            {orderedProducts.map((product) => {
              const isNew = isNewProduct(product.brand_id);
              return (
                <div
                  key={product.id}
                  className={cn(
                    'p-2 rounded-lg border space-y-1',
                    isNew ? 'border-blue-500/50 bg-blue-500/5' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{product.brand_name}</span>
                        {isNew && (
                          <Badge className="bg-blue-500 text-[9px] px-1.5 py-0">New</Badge>
                        )}
                        {product.needs_order && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Needs Order</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Current: {product.current_tubes_left ?? 0} tubes
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatLastOrder(product.last_order_date)}
                        </span>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={counts[product.id] ?? ''}
                      onChange={(e) => handleCountChange(product.id, parseInt(e.target.value) || 0)}
                      className="w-16 h-7 text-xs text-center"
                      placeholder="0"
                    />
                    <Input
                      value={notes[product.id] ?? ''}
                      onChange={(e) => handleNoteChange(product.id, e.target.value)}
                      className="w-24 h-7 text-xs"
                      placeholder="Notes"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={saveTubeCounts}
            disabled={savingCounts}
          >
            <Save className="h-3 w-3" />
            {savingCounts ? 'Saving...' : 'Save Counts'}
          </Button>
        </div>

        {/* Inventory Photo Upload */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Inventory Photos
          </Label>
          
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm font-medium text-foreground">Tap to take photo or upload</p>
            <p className="text-[10px] text-muted-foreground">Supports JPG, PNG · Multiple files allowed</p>
          </div>

          {/* Photo previews */}
          {previews.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {previews.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePreview(idx)}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs gap-1"
                  onClick={clearAll}
                >
                  <Trash2 className="h-3 w-3" /> Clear All
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs gap-1"
                  onClick={savePhotos}
                  disabled={savingPhotos}
                >
                  <Upload className="h-3 w-3" />
                  {savingPhotos ? 'Uploading...' : 'Save Photos'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChecklistSection>
  );
}
