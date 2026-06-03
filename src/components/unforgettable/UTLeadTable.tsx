import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MessageSquare, Bot, Trash2, Eye } from 'lucide-react';
import { UTPartnerLead, UTOutreachLog } from '@/hooks/useUTPartnerLeads';
import { useState } from 'react';
import { format } from 'date-fns';
import { OutreachActions } from '@/components/communication/OutreachActions';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500',
  contacted: 'bg-yellow-500/10 text-yellow-500',
  interested: 'bg-green-500/10 text-green-500',
  callback: 'bg-orange-500/10 text-orange-500',
  onboarded: 'bg-emerald-500/10 text-emerald-500',
  dead: 'bg-destructive/10 text-destructive',
};

interface Props {
  leads: UTPartnerLead[];
  isLoading: boolean;
  selectedLead: UTPartnerLead | null;
  onSelectLead: (lead: UTPartnerLead | null) => void;
  onUpdateLead: (id: string, updates: Partial<UTPartnerLead>) => void;
  onDeleteLead: (id: string) => void;
  onLogOutreach: (input: { lead_id: string; channel: string; outcome: string; notes?: string }) => void;
  outreachLogs: UTOutreachLog[];
}

export function UTLeadTable({ leads, isLoading, selectedLead, onSelectLead, onUpdateLead, onDeleteLead, onLogOutreach, outreachLogs }: Props) {
  const [logChannel, setLogChannel] = useState('call');
  const [logOutcome, setLogOutcome] = useState('no_answer');
  const [logNotes, setLogNotes] = useState('');

  const handleLogSubmit = () => {
    if (!selectedLead) return;
    onLogOutreach({ lead_id: selectedLead.id, channel: logChannel, outcome: logOutcome, notes: logNotes || undefined });
    setLogNotes('');
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading leads...</div>;
  }

  return (
    <>
      <div className="rounded-md border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>AI Score</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leads found. Add your first partner lead!</TableCell></TableRow>
            )}
            {leads.map(lead => (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelectLead(lead)}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{lead.business_name}</p>
                    {lead.contact_name && <p className="text-xs text-muted-foreground">{lead.contact_name}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{(lead.category || '').replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell className="text-sm">{[lead.city, lead.state].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell>
                  <Badge className={`text-xs ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`font-mono text-sm font-bold ${lead.ai_score >= 70 ? 'text-green-500' : lead.ai_score >= 40 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {lead.ai_score}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{lead.source}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelectLead(lead)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteLead(lead.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Lead Detail Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && onSelectLead(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedLead.business_name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Lead Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Contact:</span> {selectedLead.contact_name || '—'}</div>
                  <div><span className="text-muted-foreground">Category:</span> {(selectedLead.category || '').replace('_', ' ')}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedLead.phone || '—'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedLead.email || '—'}</div>
                  <div><span className="text-muted-foreground">Location:</span> {[selectedLead.city, selectedLead.state].filter(Boolean).join(', ') || '—'}</div>
                  <div><span className="text-muted-foreground">AI Score:</span> <span className="font-bold">{selectedLead.ai_score}</span></div>
                </div>

                {/* Quick Status */}
                <div>
                  <label className="text-xs text-muted-foreground">Update Status</label>
                  <Select value={selectedLead.status} onValueChange={v => onUpdateLead(selectedLead.id, { status: v } as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="interested">Interested</SelectItem>
                      <SelectItem value="callback">Callback</SelectItem>
                      <SelectItem value="onboarded">Onboarded</SelectItem>
                      <SelectItem value="dead">Dead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  {selectedLead.phone && (
                    <OutreachActions
                      phone={selectedLead.phone}
                      entityName={selectedLead.business_name}
                      entityType="store"
                      entityId={selectedLead.id}
                      businessKey="unforgettable"
                    />
                  )}
                </div>

                {/* Log Outreach */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">Log Outreach</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={logChannel} onValueChange={setLogChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="ai_call">AI Call</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={logOutcome} onValueChange={setLogOutcome}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_answer">No Answer</SelectItem>
                        <SelectItem value="voicemail">Voicemail</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="callback">Callback</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="closed">Closed / Onboarded</SelectItem>
                        <SelectItem value="wrong_number">Wrong Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea placeholder="Notes..." value={logNotes} onChange={e => setLogNotes(e.target.value)} className="h-16" />
                  <Button size="sm" onClick={handleLogSubmit}>Log</Button>
                </div>

                {/* Outreach History */}
                <div>
                  <p className="text-sm font-medium mb-2">Outreach History</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {outreachLogs.length === 0 && <p className="text-xs text-muted-foreground">No outreach logged yet</p>}
                    {outreachLogs.map(log => (
                      <div key={log.id} className="border border-border rounded p-2 text-xs">
                        <div className="flex justify-between">
                          <Badge variant="outline" className="text-[10px]">{log.channel}</Badge>
                          <Badge className={`text-[10px] ${log.outcome === 'interested' || log.outcome === 'closed' ? 'bg-green-500/10 text-green-500' : ''}`}>{log.outcome}</Badge>
                        </div>
                        {log.notes && <p className="mt-1 text-muted-foreground">{log.notes}</p>}
                        <p className="mt-1 text-muted-foreground/60">{format(new Date(log.created_at), 'MMM d, yyyy, h:mm a')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
