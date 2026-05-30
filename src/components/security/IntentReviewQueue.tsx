/**
 * Intent Review Queue Component
 * Phase 4: Controlled Autonomy & Intent Resolution
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  Edit,
  Search,
  AlertTriangle,
  Clock,
  User,
  Smartphone,
  FileJson,
  Loader2,
} from 'lucide-react';
import { useIntentOps, IntentReviewItem } from '@/hooks/useIntentOps';

export function IntentReviewQueue() {
  const {
    reviewQueue,
    isLoadingQueue,
    approveIntent,
    rejectIntent,
    amendIntent,
    isApproving,
    isRejecting,
    isAmending,
  } = useIntentOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<IntentReviewItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'amend' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [amendedEffect, setAmendedEffect] = useState('');

  const filteredQueue = reviewQueue.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.intent_type.toLowerCase().includes(query) ||
      item.portal_type.toLowerCase().includes(query) ||
      item.intent_id.toLowerCase().includes(query)
    );
  });

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge variant="destructive">Critical</Badge>;
    if (priority >= 5) return <Badge className="bg-yellow-500 hover:bg-yellow-600">High</Badge>;
    if (priority >= 3) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'escalated':
        return <Badge variant="destructive">Escalated</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAction = () => {
    if (!selectedIntent || !actionType) return;

    switch (actionType) {
      case 'approve':
        approveIntent({ intentId: selectedIntent.intent_id, notes: actionNotes });
        break;
      case 'reject':
        if (!actionNotes.trim()) {
          return; // Require reason for rejection
        }
        rejectIntent({ intentId: selectedIntent.intent_id, reason: actionNotes });
        break;
      case 'amend':
        try {
          const parsedEffect = JSON.parse(amendedEffect);
          amendIntent({
            intentId: selectedIntent.intent_id,
            amendedEffect: parsedEffect,
            notes: actionNotes,
          });
        } catch {
          return; // Invalid JSON
        }
        break;
    }

    setSelectedIntent(null);
    setActionType(null);
    setActionNotes('');
    setAmendedEffect('');
  };

  const openActionDialog = (intent: IntentReviewItem, type: 'approve' | 'reject' | 'amend') => {
    setSelectedIntent(intent);
    setActionType(type);
    if (type === 'amend') {
      setAmendedEffect(JSON.stringify(intent.proposed_effect, null, 2));
    }
  };

  if (isLoadingQueue) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <span className="text-sm text-muted-foreground">
            {filteredQueue.length} intent{filteredQueue.length !== 1 ? 's' : ''} awaiting review
          </span>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search intents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Queue table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Intent Type</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Review Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No intents pending review
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQueue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell className="font-mono text-sm">{item.intent_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.portal_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.client_timestamp), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {item.review_reason || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openActionDialog(item, 'approve')}
                            disabled={isApproving}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openActionDialog(item, 'reject')}
                            disabled={isRejecting}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openActionDialog(item, 'amend')}
                            disabled={isAmending}
                          >
                            <Edit className="h-4 w-4 text-blue-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => {
        setActionType(null);
        setSelectedIntent(null);
        setActionNotes('');
        setAmendedEffect('');
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-destructive" />}
              {actionType === 'amend' && <Edit className="h-5 w-5 text-blue-500" />}
              {actionType === 'approve' && 'Approve Intent'}
              {actionType === 'reject' && 'Reject Intent'}
              {actionType === 'amend' && 'Amend Intent'}
            </DialogTitle>
            <DialogDescription>
              Intent: {selectedIntent?.intent_type} ({selectedIntent?.portal_type})
            </DialogDescription>
          </DialogHeader>

          {selectedIntent && (
            <div className="space-y-4">
              {/* Intent Details */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Intent Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">User:</span>
                    <code className="text-xs">{selectedIntent.user_id}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Device:</span>
                    <code className="text-xs">{selectedIntent.device_id}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span>{format(new Date(selectedIntent.client_timestamp), 'PPpp')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Proposed Effect */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  {actionType === 'amend' ? 'Amended Effect (JSON)' : 'Proposed Effect'}
                </Label>
                {actionType === 'amend' ? (
                  <Textarea
                    value={amendedEffect}
                    onChange={(e) => setAmendedEffect(e.target.value)}
                    className="font-mono text-xs h-32"
                    placeholder="Enter valid JSON..."
                  />
                ) : (
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedIntent.proposed_effect, null, 2)}
                  </pre>
                )}
              </div>

              {/* Notes/Reason */}
              <div className="space-y-2">
                <Label>
                  {actionType === 'reject' ? 'Rejection Reason (required)' : 'Notes (optional)'}
                </Label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={
                    actionType === 'reject'
                      ? 'Explain why this intent is being rejected...'
                      : 'Add any relevant notes...'
                  }
                  className="h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedIntent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={
                (actionType === 'reject' && !actionNotes.trim()) ||
                isApproving ||
                isRejecting ||
                isAmending
              }
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {(isApproving || isRejecting || isAmending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'amend' && 'Apply Amendment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
