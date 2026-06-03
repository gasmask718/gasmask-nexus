import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Bot, Mail, PlayCircle } from 'lucide-react';
import { UTPartnerLead } from '@/hooks/useUTPartnerLeads';
import { OutreachActions } from '@/components/communication/OutreachActions';

interface Props {
  leads: UTPartnerLead[];
  onLogOutreach: (input: { lead_id: string; channel: string; outcome: string; notes?: string }) => void;
}

export function UTOutreachPanel({ leads, onLogOutreach }: Props) {
  const newLeads = leads.filter(l => l.status === 'new' || l.status === 'callback');
  const prioritized = [...newLeads].sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));

  return (
    <div className="space-y-4">
      {/* Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <Phone className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Cold Calling</p>
              <p className="text-xs text-muted-foreground">Manual + Twilio dialer</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <MessageSquare className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium text-sm">SMS Outreach</p>
              <p className="text-xs text-muted-foreground">Twilio + BizText</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10">
              <Bot className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium text-sm">AI Calling</p>
              <p className="text-xs text-muted-foreground">ElevenLabs agents</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-500/10">
              <Mail className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Email Campaigns</p>
              <p className="text-xs text-muted-foreground">Template-driven</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>📞 Priority Call Queue ({prioritized.length} leads)</span>
            <Button size="sm" className="gap-1"><PlayCircle className="h-4 w-4" /> Start Dialing</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {prioritized.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No leads in queue. Add new leads to start outreach.</p>
            )}
            {prioritized.slice(0, 15).map((lead, i) => (
              <div key={lead.id} className="flex items-center justify-between p-2 rounded-md border border-border/50 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone || 'No phone'} • {(lead.category || '').replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${lead.ai_score >= 70 ? 'border-green-500 text-green-500' : ''}`}>
                    Score: {lead.ai_score}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                  {lead.phone && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => window.open(`tel:${lead.phone}`)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* VA Script Card */}
      <Card className="border-pink-500/20 bg-pink-500/5">
        <CardHeader>
          <CardTitle className="text-sm">🎤 Master Cold Call Script</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="bg-background/50 rounded p-3 border border-border/30">
            <p className="italic">"Hey, is this the owner?</p>
            <p className="italic mt-2">My name is <strong>[Your Name]</strong> — I'm building a platform that's bringing consistent event bookings directly to vendors like you — event halls, decorators, bartenders — all in one place.</p>
            <p className="italic mt-2">We already have customers coming in, and I'm reaching out to bring in top partners in your area before we scale fully.</p>
            <p className="italic mt-2">Would you be open to getting more consistent bookings if we send them directly to you?"</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-green-500/10 rounded p-2">
              <p className="font-semibold text-green-500">If YES:</p>
              <p>"Perfect — I'll send you a quick link to get set up, takes 2 minutes."</p>
            </div>
            <div className="bg-yellow-500/10 rounded p-2">
              <p className="font-semibold text-yellow-500">If HESITATION:</p>
              <p>"No upfront cost — we bring you customers first. You only focus on fulfilling."</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
