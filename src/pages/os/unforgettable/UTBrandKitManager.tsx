import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Palette, Package, FileText, Factory, Download, Mail, Pencil, QrCode, Upload } from 'lucide-react';

const PINK = '#E91E8C';

export default function UTBrandKitManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: kit } = useQuery({
    queryKey: ['ut-brand-kit'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_brand_kits' as any).select('*').eq('active', true).limit(1).maybeSingle();
      if (data) setForm(data);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (kit?.id) {
        const { error } = await supabase.from('ut_brand_kits' as any).update({ ...values, updated_at: new Date().toISOString() }).eq('id', kit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ut_brand_kits' as any).insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-brand-kit'] });
      setEditing(false);
      toast.success('Brand kit saved');
    },
  });

  const ColorSwatch = ({ hex, label }: { hex: string; label: string }) => (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg border border-border shadow-sm" style={{ backgroundColor: hex }} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">{hex}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>🎨 Brand Kit Manager</h1>
          <p className="text-muted-foreground">Your master brand file — send this to every supplier</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info('PDF generation coming soon')}><Download className="h-4 w-4 mr-1" /> Download Brand Pack v1</Button>
          <Button variant="outline" onClick={() => toast.info('Email compose coming soon')}><Mail className="h-4 w-4 mr-1" /> Email to Supplier</Button>
          <Button onClick={() => setEditing(!editing)}><Pencil className="h-4 w-4 mr-1" /> {editing ? 'Cancel' : 'Edit Brand Kit'}</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
        Every supplier must receive Brand Pack v1 before they are approved to manufacture Unforgettable Times products.
      </p>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Brand Kit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Brand Name</Label><Input value={form.brand_name || ''} onChange={e => setForm({ ...form, brand_name: e.target.value })} /></div>
              <div><Label>Version</Label><Input value={form.version || ''} onChange={e => setForm({ ...form, version: e.target.value })} /></div>
              <div><Label>Primary Color</Label><Input value={form.primary_color_hex || ''} onChange={e => setForm({ ...form, primary_color_hex: e.target.value })} /></div>
              <div><Label>Secondary Color</Label><Input value={form.secondary_color_hex || ''} onChange={e => setForm({ ...form, secondary_color_hex: e.target.value })} /></div>
              <div><Label>Accent Color</Label><Input value={form.accent_color_hex || ''} onChange={e => setForm({ ...form, accent_color_hex: e.target.value })} /></div>
              <div><Label>Pantone Primary</Label><Input value={form.pantone_primary || ''} onChange={e => setForm({ ...form, pantone_primary: e.target.value })} /></div>
              <div><Label>Primary Font</Label><Input value={form.primary_font || ''} onChange={e => setForm({ ...form, primary_font: e.target.value })} /></div>
              <div><Label>Secondary Font</Label><Input value={form.secondary_font || ''} onChange={e => setForm({ ...form, secondary_font: e.target.value })} /></div>
              <div><Label>Logo PNG URL</Label><Input value={form.logo_png_url || ''} onChange={e => setForm({ ...form, logo_png_url: e.target.value })} /></div>
              <div><Label>Logo SVG URL</Label><Input value={form.logo_svg_url || ''} onChange={e => setForm({ ...form, logo_svg_url: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save Brand Kit'}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section A — Identity */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Brand Identity</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2">Logo Files</p>
                <div className="flex gap-2">
                  {kit?.logo_png_url ? <Badge variant="secondary">PNG ✅</Badge> : <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" />PNG</Button>}
                  {kit?.logo_svg_url ? <Badge variant="secondary">SVG ✅</Badge> : <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" />SVG</Button>}
                  {kit?.logo_ai_url ? <Badge variant="secondary">AI ✅</Badge> : <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" />AI</Button>}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-3">Color Palette</p>
                <div className="space-y-3">
                  <ColorSwatch hex={kit?.primary_color_hex || '#7C3AED'} label="Primary" />
                  <ColorSwatch hex={kit?.secondary_color_hex || '#EC4899'} label="Secondary" />
                  <ColorSwatch hex={kit?.accent_color_hex || '#F59E0B'} label="Accent" />
                </div>
                {kit?.pantone_primary && <p className="text-xs text-muted-foreground mt-2">Pantone: {kit.pantone_primary}</p>}
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Typography</p>
                <p className="text-sm text-muted-foreground">Headers: <strong>{kit?.primary_font || 'Montserrat Bold'}</strong></p>
                <p className="text-sm text-muted-foreground">Body: {kit?.secondary_font || 'Open Sans'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Section B — Packaging */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Packaging System</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Box Templates</p>
                <div className="flex gap-2">
                  {['Small Kit', 'Medium Kit', 'Large Kit'].map(s => (
                    <Button key={s} size="sm" variant="outline">{s}</Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Label Templates</p>
                <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload Label Template</Button>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Sticker Designs</p>
                <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload Sticker File</Button>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Tape Branding</p>
                <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload Tape Design</Button>
              </div>
            </CardContent>
          </Card>

          {/* Section C — Insert System */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Insert System</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Thank You Card</p>
                <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload / View Template</Button>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Setup Instructions Card</p>
                <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload / View Template</Button>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">QR Code System</p>
                {[
                  { label: '📱 Customer QR', desc: 'Scans → Reorder page' },
                  { label: '🏭 Supplier QR', desc: 'Scans → Batch tracking' },
                  { label: '🤝 Ambassador QR', desc: 'Scans → Affiliate tracking' },
                ].map(q => (
                  <div key={q.label} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div>
                      <p className="text-sm font-medium">{q.label}</p>
                      <p className="text-xs text-muted-foreground">{q.desc}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost"><QrCode className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section D — Supplier Requirements */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" /> Supplier Branding Requirements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">What every supplier must do:</p>
                <div className="space-y-1">
                  {[
                    'Apply logo per spec sheet',
                    'Use approved colors only',
                    'Include insert card in box',
                    'No supplier branding visible',
                    'Send mockup before production',
                    'Send sample before bulk order',
                  ].map(r => (
                    <p key={r} className="text-sm flex items-center gap-2">
                      <span className="text-green-500">✅</span> {r}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Logo Application Methods:</p>
                <div className="flex gap-2 flex-wrap">
                  {['Print', 'Emboss', 'Engraving', 'Sticker'].map(m => (
                    <Badge key={m} variant="outline">☑ {m}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
