import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Coins, Link2, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SETTING_KEY = 'crypto.external_url';
const LEGACY_LS_KEY = 'owner.crypto.external_url';

/**
 * Crypto Hub — EXTERNAL PLATFORM PENDING.
 * URL persists in owner_settings (DB-backed; follows owner across devices).
 */
export default function OwnerCryptoDetailPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('owner_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      let value = (data?.value as any)?.url as string | undefined;
      if (!value) {
        // One-time migration from localStorage
        const legacy = localStorage.getItem(LEGACY_LS_KEY);
        if (legacy) {
          value = legacy;
          await (supabase as any)
            .from('owner_settings')
            .upsert({ key: SETTING_KEY, value: { url: legacy } }, { onConflict: 'key' });
          localStorage.removeItem(LEGACY_LS_KEY);
        }
      }
      if (value) { setSavedUrl(value); setUrl(value); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const trimmed = url.trim();
    if (!trimmed) { toast.error('Paste a URL first'); return; }
    try { new URL(trimmed); } catch { toast.error('Not a valid URL'); return; }
    const { error } = await (supabase as any)
      .from('owner_settings')
      .upsert({ key: SETTING_KEY, value: { url: trimmed } }, { onConflict: 'key' });
    if (error) { toast.error(error.message); return; }
    setSavedUrl(trimmed);
    toast.success('Link saved. Follows you across devices.');
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30">
            <Coins className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crypto Hub</h1>
            <p className="text-sm text-muted-foreground">External platform — connection pending</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto bg-orange-500/10 text-orange-400 border-orange-500/30">PLANNED</Badge>
      </div>

      <Card className="rounded-xl border-orange-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-orange-400" />
            Connect external trading platform
          </CardTitle>
          <CardDescription className="text-xs">
            Paste the URL of the separate trading site. Saved to your owner settings — follows you across devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crypto-url">Platform URL</Label>
            <div className="flex gap-2">
              <Input
                id="crypto-url"
                placeholder="https://your-trading-platform.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <Button onClick={save} className="shrink-0" disabled={loading}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </div>
          </div>
          {savedUrl && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
              <div className="text-sm">
                <p className="font-medium">Saved link</p>
                <p className="text-xs text-muted-foreground truncate max-w-md">{savedUrl}</p>
              </div>
              <a href={savedUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  Open <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </a>
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">
            No holdings, prices, or bot stats shown until the platform is wired. Honest empty state by design.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
