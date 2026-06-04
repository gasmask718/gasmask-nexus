import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, Coins } from 'lucide-react';

/**
 * Auto-Trading AI — bundled with Crypto Hub external link.
 * Bot performance & strategy config activate when the platform is connected.
 */
export default function OwnerAutoTradingDetailPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner/holdings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
            <Bot className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Auto-Trading AI</h1>
            <p className="text-sm text-muted-foreground">External platform — connection pending</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto bg-cyan-500/10 text-cyan-400 border-cyan-500/30">PLANNED</Badge>
      </div>

      <Card className="rounded-xl border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-base">Bundled with Crypto Hub</CardTitle>
          <CardDescription className="text-xs">
            Algorithmic bot performance, strategy configuration, and live monitoring activate once the external trading
            platform is wired in the Crypto Hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground italic">
            No bot stats, P/L, or strategy data shown until the platform is connected. Honest empty state by design.
          </p>
          <Button onClick={() => navigate('/os/owner/holdings/crypto')} variant="outline">
            <Coins className="h-4 w-4 mr-2" /> Go to Crypto Hub to connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
