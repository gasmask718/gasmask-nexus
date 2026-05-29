import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Plus, ExternalLink, Info } from 'lucide-react';
import { useCanvaTemplates } from '@/hooks/useCanvaAssets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ASSET_TYPES = [
  'store_flyer', 'product_card', 'sticker_design', 'campaign_image',
  'welcome_card', 'price_sheet', 'social_post', 'weekly_report', 'demo_banner',
];

const BRANDS = [
  '', 'GasMask', 'HotMama', 'Grabba R Us',
  'Hotscolatti Light', 'Hotscolatti Dark', 'Hotscolatti Bros',
];

export default function CanvaTemplatesPage() {
  const { data: templates, isLoading } = useCanvaTemplates();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    template_name: '',
    canva_template_id: '',
    asset_type: 'store_flyer',
    brand: '',
    description: '',
    placeholder_fields: '[{"name":"store_name"},{"name":"phone"},{"name":"product_name"}]',
  });

  const save = async () => {
    if (!form.template_name || !form.canva_template_id) {
      toast.error('Template name and Canva ID are required');
      return;
    }
    let fields: any[];
    try {
      fields = JSON.parse(form.placeholder_fields);
    } catch {
      toast.error('Invalid JSON in placeholder fields');
      return;
    }

    const { error } = await supabase.from('canva_templates' as any).insert({
      template_name: form.template_name,
      canva_template_id: form.canva_template_id,
      asset_type: form.asset_type,
      brand: form.brand || null,
      description: form.description || null,
      placeholder_fields: fields,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Template registered');
    setShowAdd(false);
    setForm({
      template_name: '',
      canva_template_id: '',
      asset_type: 'store_flyer',
      brand: '',
      description: '',
      placeholder_fields: '[{"name":"store_name"},{"name":"phone"},{"name":"product_name"}]',
    });
    queryClient.invalidateQueries({ queryKey: ['canva-templates'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Canva Templates
          </h2>
          <p className="text-muted-foreground text-sm">
            Register your Canva Brand Template IDs so Dynasty OS can auto-fill them
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {/* Instructions */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">How to get your Canva Brand Template ID:</p>
              <ol className="list-decimal list-inside text-muted-foreground text-xs space-y-0.5">
                <li>Open your design in Canva</li>
                <li>Click <strong>Share → Brand Template → Publish as Brand Template</strong></li>
                <li>Copy the template ID from the URL (e.g. DAFxxxxxxxxxx)</li>
                <li>Paste it here and map your placeholder field names</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template list */}
      <div className="space-y-3">
        {templates?.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t.template_name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.asset_type} · {t.brand || 'All brands'} · ID: <code className="text-[10px]">{t.canva_template_id}</code>
                </p>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {(t.placeholder_fields as any[])?.length || 0} fields
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => window.open(`https://www.canva.com/design/${t.canva_template_id}/edit`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" /> Open in Canva
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && !templates?.length && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="font-medium">No templates registered yet.</p>
              <p className="text-sm mt-1">Add your Canva Brand Templates above to start auto-generating designs.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add template form */}
      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">Register New Template</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template Name</Label>
                <Input
                  value={form.template_name}
                  onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))}
                  placeholder="GasMask Store Flyer"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canva Brand Template ID</Label>
                <Input
                  value={form.canva_template_id}
                  onChange={e => setForm(p => ({ ...p, canva_template_id: e.target.value }))}
                  placeholder="DAFxxxxxxxxxx"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Asset Type</Label>
                <Select value={form.asset_type} onValueChange={v => setForm(p => ({ ...p, asset_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Brand (optional)</Label>
                <Select value={form.brand || 'none'} onValueChange={v => setForm(p => ({ ...p, brand: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">All brands</SelectItem>
                    {BRANDS.filter(Boolean).map(b => (
                      <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Placeholder Fields (JSON array)</Label>
              <Textarea
                value={form.placeholder_fields}
                onChange={e => setForm(p => ({ ...p, placeholder_fields: e.target.value }))}
                rows={2}
                className="text-xs font-mono"
                placeholder='[{"name":"store_name"},{"name":"phone"},{"name":"product_name"}]'
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={save}>Save Template</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
