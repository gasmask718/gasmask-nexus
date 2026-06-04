import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Coins, Link2, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';

const LS_KEY = 'owner.crypto.external_url';

/**
 * Crypto Hub — EXTERNAL PLATFORM PENDING.
 * Honest pending state with a settings affordance to paste the trading-site link.
 * Once a URL is supplied, the deep-link vs embed vs read-bridge ruling is made.
 */
export default function OwnerCryptoDetailPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(LS_KEY);
    if (v) { setSavedUrl(v); setUrl(v); }
  }, []);

  const save = () => {
    const trimmed = url.trim();
    if (!trimmed) { toast.error('Paste a URL first'); return; }
    try { new URL(trimmed); } catch { toast.error('Not a valid URL'); return; }
    localStorage.setItem(LS_KEY, trimmed);
    setSavedUrl(trimmed);
    toast.success('Link saved. Awaiting connection ruling.');
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
            Paste the URL (or Supabase project ref) of the separate trading site. Once supplied, the team rules deep-link vs embed vs read-bridge.
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
              />
              <Button onClick={save} className="shrink-0">
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
