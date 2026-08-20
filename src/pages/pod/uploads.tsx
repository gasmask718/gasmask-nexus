import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Image as ImageIcon, Palette } from "lucide-react";
import { toast } from "sonner";

const CHANNELS = ["printify", "etsy", "ebay", "amazon", "shopify"] as const;
const CHANNEL_KEYS: Record<string, string> = {
  printify: "PRINTIFY_API_KEY",
  etsy: "ETSY_API_KEY",
  ebay: "EBAY_API_TOKEN",
  amazon: "AMAZON_SP_API_TOKEN",
  shopify: "SHOPIFY_ADMIN_API_TOKEN",
};

export default function PODUpload() {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("evergreen");
  const [file, setFile] = useState<File | null>(null);
  const [canvaAssets, setCanvaAssets] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("generated_assets")
        .select("*")
        .in("asset_type", ["product_card", "campaign_image", "sticker_design"])
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(24);
      setCanvaAssets(data || []);
    })();
  }, []);

  const createDesignWithListings = async (imageUrl: string, t: string, src: string) => {
    const { data: design, error } = await supabase
      .from("pod_designs")
      .insert({
        title: t,
        category,
        ai_description: `Manual ${src}`,
        design_image_url: imageUrl,
        tags: [category, src],
        generated_by_ai: false,
        status: "new",
      })
      .select()
      .single();
    if (error) throw error;

    const listings = CHANNELS.map((ch) => ({
      design_id: design.id,
      channel: ch,
      status: "pending_keys" as const, // client cannot check secrets; safe default
      metadata: { required_secret: CHANNEL_KEYS[ch], source: src },
    }));
    const { error: listErr } = await supabase.from("pod_listings" as any).insert(listings);
    if (listErr) throw listErr;
    return design;
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Pick a file and title");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `manual/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pod-designs").upload(path, file, {
        contentType: file.type || "image/png",
      });
      if (upErr) throw upErr;
      // pod-designs is private: store the object path; reads mint a signed URL.
      const design = await createDesignWithListings(path, title, "manual_upload");
      toast.success(`Design "${design.title}" uploaded · 5 draft listings created`);
      setFile(null);
      setTitle("");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleImportCanva = async (asset: any) => {
    const url = asset.canva_export_url || asset.thumbnail_url;
    if (!url) {
      toast.error("Asset has no export URL yet");
      return;
    }
    setImporting(true);
    try {
      const t = asset.product_name || `Canva · ${asset.asset_type}`;
      await createDesignWithListings(url, t, "canva_import");
      toast.success(`Imported "${t}" from Canva assets`);
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Design Intake</h1>
        <p className="text-muted-foreground">
          Manual file upload <span className="mx-1">·</span> Import from Brandaro Canva assets <span className="mx-1">·</span> Every intake spawns 5 draft listings (one per channel)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Manual Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design title" />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evergreen">Evergreen</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="hot_mama">Hot Mama</SelectItem>
                  <SelectItem value="gasmask">GasMask</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">File</label>
              <Input type="file" accept="image/png,image/jpeg,image/webp"
                     onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                         : <><Upload className="mr-2 h-4 w-4" /> Upload & Create Listings</>}
            </Button>
          </CardContent>
        </Card>

        {/* Canva import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> Import from Canva Assets
              <Badge variant="outline" className="ml-auto">{canvaAssets.length} ready</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canvaAssets.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No Canva assets available yet. Generate some in Brandaro → Design Assets.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-auto">
                {canvaAssets.map((a) => (
                  <button key={a.id} disabled={importing}
                          onClick={() => handleImportCanva(a)}
                          className="border rounded p-1 hover:bg-muted text-left disabled:opacity-50">
                    {a.thumbnail_url ? (
                      <img src={a.thumbnail_url} alt="" className="w-full h-20 object-cover rounded" />
                    ) : (
                      <div className="w-full h-20 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 opacity-40" />
                      </div>
                    )}
                    <div className="text-xs mt-1 truncate">{a.product_name || a.asset_type}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
