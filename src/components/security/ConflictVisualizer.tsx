/**
 * Conflict Visualizer Component
 * Phase 4: Controlled Autonomy & Intent Resolution
 * Schema-aligned with actual database structure
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Clock,
  Database,
  Shield,
  FileWarning,
  Lock,
  Eye,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useIntentOps, ConflictLogEntry } from '@/hooks/useIntentOps';
import { supabase } from '@/integrations/supabase/client';

interface ConflictingIntentDetail {
  intent_id: string;
  intent_type: string;
  portal_type: string;
  proposed_effect: Record<string, unknown>;
  client_timestamp: string;
  status: string;
  user_id: string;
}

export function ConflictVisualizer() {
  const { conflictLogs, isLoadingConflicts } = useIntentOps();
  const [selectedConflict, setSelectedConflict] = useState<ConflictLogEntry | null>(null);
  const [conflictingIntents, setConflictingIntents] = useState<ConflictingIntentDetail[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!selectedConflict) {
      setConflictingIntents([]);
      return;
    }

    const fetchIntentDetails = async () => {
      setIsLoadingDetails(true);
      try {
        // Use intent_ids array from schema
        const allIntentIds = selectedConflict.intent_ids || [];

        const { data, error } = await supabase
          .from('intent_envelopes')
          .select('intent_id, intent_type, portal_type, proposed_effect, client_timestamp, status, user_id')
          .in('intent_id', allIntentIds);

        if (error) throw error;

        setConflictingIntents(
          (data || []).map(row => ({
            intent_id: row.intent_id,
            intent_type: row.intent_type,
            portal_type: row.portal_type,
            proposed_effect: (row.proposed_effect as Record<string, unknown>) || {},
            client_timestamp: row.client_timestamp,
            status: row.status,
            user_id: row.user_id,
          }))
        );
      } catch (err) {
        console.error('Failed to fetch intent details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchIntentDetails();
  }, [selectedConflict]);

  const getConflictClassIcon = (conflictClass: string) => {
    switch (conflictClass) {
      case 'temporal':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resource':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'authority':
        return <Shield className="h-4 w-4 text-purple-500" />;
      case 'evidence':
        return <FileWarning className="h-4 w-4 text-orange-500" />;
      case 'integrity':
        return <Lock className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConflictClassBadge = (conflictClass: string) => {
    const variants: Record<string, string> = {
      temporal: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
      resource: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
      authority: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
      evidence: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
      integrity: 'bg-red-500/20 text-red-700 border-red-500/30',
    };

    return (
      <Badge variant="outline" className={variants[conflictClass] || ''}>
        {conflictClass}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-500/20 text-green-700">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'modified':
        return <Badge className="bg-blue-500/20 text-blue-700">Modified</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoadingConflicts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        <span className="text-sm text-muted-foreground">
          {conflictLogs.length} conflict{conflictLogs.length !== 1 ? 's' : ''} logged
        </span>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {conflictLogs.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                No conflicts detected
              </CardContent>
            </Card>
          ) : (
            conflictLogs.map((conflict) => (
              <Card
                key={conflict.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedConflict(conflict)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getConflictClassIcon(conflict.conflict_class)}
                      {getConflictClassBadge(conflict.conflict_class)}
                      <span className="text-sm text-muted-foreground">
                        {conflict.intent_ids.length} intents involved
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {conflict.resolved_at && (
                        <Badge variant="outline" className="text-green-600">
                          Resolved
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm line-clamp-2">{conflict.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(conflict.detected_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConflict && getConflictClassIcon(selectedConflict.conflict_class)}
              Conflict Details
            </DialogTitle>
            <DialogDescription>
              Comparing conflicting intents side-by-side
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Conflict Analysis
                    {getConflictClassBadge(selectedConflict.conflict_class)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedConflict.description}</p>
                  {selectedConflict.resolution_explanation && (
                    <div className="mt-3 p-2 bg-green-500/10 rounded-lg text-sm">
                      <strong>Resolution:</strong> {selectedConflict.resolution_explanation}
                    </div>
                  )}
                </CardContent>
              </Card>

              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {conflictingIntents.map((intent, index) => (
                    <Card
                      key={intent.intent_id}
                      className={
                        intent.intent_id === selectedConflict.primary_intent_id
                          ? 'border-primary'
                          : ''
                      }
                    >
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>
                            {intent.intent_id === selectedConflict.primary_intent_id
                              ? 'Primary Intent'
                              : `Conflicting Intent ${index}`}
                          </span>
                          {getStatusBadge(intent.status)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type:</span>{' '}
                          <code className="text-xs bg-muted px-1 rounded">
                            {intent.intent_type}
                          </code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Portal:</span>{' '}
                          <Badge variant="outline" className="capitalize">
                            {intent.portal_type}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>{' '}
                          {format(new Date(intent.client_timestamp), 'PPpp')}
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Proposed Effect:
                          </span>
                          <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(intent.proposed_effect, null, 2)}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
