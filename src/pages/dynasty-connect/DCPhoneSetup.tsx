import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Phone, AlertTriangle, CheckCircle, Loader2, Search, ShoppingCart, Wifi, Copy,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DCPhoneSetup() {
  const queryClient = useQueryClient();
  const [areaCode, setAreaCode] = useState('929');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);

  // Current DC numbers
  const { data: dcNumbers = [] } = useQuery({
    queryKey: ['dc-phone-numbers'],
    queryFn: async () => {
      const { data } = await supabase.from('dc_phone_numbers').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const hasActiveNumber = dcNumbers.some((n: any) => n.status === 'active');

  // Search available numbers
  const searchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('provision-dc-number', {
        body: { action: 'search', area_code: areaCode },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setAvailableNumbers(data.numbers || []);
      if (!data.numbers?.length) toast.info('No numbers found for that area code. Try another.');
    },
    onError: (e: any) => toast.error('Search failed: ' + e.message),
  });

  // Purchase number
  const purchaseMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const { data, error } = await supabase.functions.invoke('provision-dc-number', {
        body: { action: 'purchase', phone_number: phoneNumber, friendly_name: 'Dynasty Connect AI' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`✅ Number purchased: ${data.phone_number}`);
      setAvailableNumbers([]);
      setSelectedNumber('');
      queryClient.invalidateQueries({ queryKey: ['dc-phone-numbers'] });
    },
    onError: (e: any) => toast.error('Purchase failed: ' + e.message),
  });

  const formatPhone = (p: string) => {
    const d = p.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
    return p;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Phone className="h-6 w-6" /> Phone Number Setup
        </h1>
        <p className="text-sm text-muted-foreground">Provision a dedicated number for Dynasty Connect AI agents</p>
      </div>

      {/* Current Status */}
      {!hasActiveNumber ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dynasty Connect needs its own dedicated phone number</AlertTitle>
          <AlertDescription>
            +1 (848) 400-4179 is currently assigned to GasMask and conflicts with AI agent routing.
            Purchase a new number below to resolve this.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-500/50 bg-green-500/5">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-500">Dynasty Connect number is active</AlertTitle>
          <AlertDescription>
            Your AI agents are live and receiving calls on the number below.
          </AlertDescription>
        </Alert>
      )}

      {/* Active DC Numbers */}
      {dcNumbers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">📞 Dynasty Connect Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dcNumbers.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-mono font-bold">{formatPhone(n.phone_number)}</p>
                      <p className="text-xs text-muted-foreground">{n.friendly_name} · AI Inbound</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-500 border-green-500">{n.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => {
                      navigator.clipboard.writeText(n.phone_number);
                      toast.success('Number copied!');
                    }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provision New Number */}
      {!hasActiveNumber && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🔍 Search Available Numbers</CardTitle>
            <CardDescription>Find a number in your preferred area code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">Area Code</Label>
                <Input
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  placeholder="929"
                  maxLength={3}
                  className="font-mono"
                />
              </div>
              <Button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending}>
                {searchMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Searching...</>
                  : <><Search className="h-4 w-4 mr-1" /> Find Numbers</>}
              </Button>
            </div>

            {/* Results */}
            {availableNumbers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-semibold">Available Numbers:</p>
                {availableNumbers.map((n: any) => (
                  <div
                    key={n.phone_number}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedNumber === n.phone_number
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedNumber(n.phone_number)}
                  >
                    <div>
                      <p className="font-mono font-semibold">{formatPhone(n.phone_number)}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.locality}, {n.region}
                      </p>
                    </div>
                    {selectedNumber === n.phone_number && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}

                {selectedNumber && (
                  <Button
                    className="w-full mt-3"
                    onClick={() => purchaseMutation.mutate(selectedNumber)}
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending
                      ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Purchasing...</>
                      : <><ShoppingCart className="h-4 w-4 mr-1" /> Purchase {formatPhone(selectedNumber)}</>}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* What happens after purchase */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ℹ️ How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>New number is auto-wired to the <code className="text-foreground">twilio-inbound-call</code> webhook</li>
            <li>All inbound calls route directly to ElevenLabs AI agents</li>
            <li>GasMask keeps +1 (848) 400-4179 — zero conflicts</li>
            <li>Monthly cost: ~$1.00/month via Twilio</li>
            <li>SMS also enabled on the new number</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
