import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, Mic, Activity } from 'lucide-react';

export default function OwnerVoiceAI() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30">
            <Mic className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Voice Call</h1>
            <p className="text-sm text-muted-foreground">Voice-based empire command</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-violet-500/20 text-violet-400 border-violet-500/30 ml-auto">
          Advanced Suite
        </Badge>
      </div>

      {/* Coming Soon Card */}
      <Card className="rounded-xl border-violet-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-violet-400" />
            AI Voice Command Interface
          </CardTitle>
          <CardDescription>
            This module is part of the advanced Owner Suite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 rounded-lg border bg-card/50 text-center">
            <Mic className="h-12 w-12 text-violet-400 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Voice Command Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Speak naturally to control your empire. Issue commands, get reports, 
              and manage operations hands-free with AI voice integration.
            </p>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
            <Activity className="h-5 w-5 text-violet-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Planned Features</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Voice-activated data queries</li>
                <li>• Hands-free alert management</li>
                <li>• Voice memos and action logging</li>
                <li>• Multi-language support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate('/os/owner')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Owner Dashboard
      </Button>
    </div>
  );
}
