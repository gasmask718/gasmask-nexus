/**
 * Resolution Inspector Component
 * Phase 4: Controlled Autonomy & Intent Resolution
 * Schema-aligned with actual database structure
 */

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  FileSearch,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  User,
  Bot,
  Loader2,
  Info,
} from 'lucide-react';
import { useIntentOps, IntentResolutionDetail, AutonomyEnvelopeDetail } from '@/hooks/useIntentOps';

export function ResolutionInspector() {
  const { fetchResolutionDetail } = useIntentOps();
  const [searchIntentId, setSearchIntentId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [resolution, setResolution] = useState<IntentResolutionDetail | null>(null);
  const [autonomyEnvelope, setAutonomyEnvelope] = useState<AutonomyEnvelopeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchIntentId.trim()) return;

    setIsSearching(true);
    setError(null);
    setResolution(null);
    setAutonomyEnvelope(null);

    try {
      const result = await fetchResolutionDetail(searchIntentId.trim());
      setResolution(result.resolution);
      setAutonomyEnvelope(result.autonomyEnvelope);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intent not found');
    } finally {
      setIsSearching(false);
    }
  }, [searchIntentId, fetchResolutionDetail]);

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'modified':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'escalated':
        return <Clock className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, string> = {
      accepted: 'bg-green-500/20 text-green-700 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-700 border-red-500/30',
      modified: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
      escalated: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
      deferred: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
    };

    return (
      <Badge variant="outline" className={variants[outcome] || ''}>
        {outcome}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Inspect Resolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="intent-search" className="sr-only">
                Intent ID
              </Label>
              <Input
                id="intent-search"
                placeholder="Enter Intent ID (UUID)..."
                value={searchIntentId}
                onChange={(e) => setSearchIntentId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchIntentId.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {resolution && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getOutcomeIcon(resolution.outcome)}
                  Resolution Outcome
                </div>
                {getOutcomeBadge(resolution.outcome)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                {resolution.was_auto_resolved ? (
                  <>
                    <Bot className="h-4 w-4 text-blue-500" />
                    <span>Auto-resolved by system</span>
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 text-purple-500" />
                    <span>Human override</span>
                  </>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Explanation</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {resolution.explanation || 'No explanation provided'}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Reason Codes</h4>
                <div className="flex flex-wrap gap-2">
                  {resolution.reason_codes.length > 0 ? (
                    resolution.reason_codes.map((code, idx) => (
                      <Badge key={idx} variant="secondary" className="font-mono text-xs">
                        {code}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No reason codes</span>
                  )}
                </div>
              </div>

              {resolution.override_by && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      Override Details
                    </h4>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Overridden by:</span>{' '}
                        <code className="text-xs bg-muted px-1 rounded">{resolution.override_by}</code>
                      </div>
                      {resolution.override_reason && (
                        <div>
                          <span className="text-muted-foreground">Reason:</span>{' '}
                          {resolution.override_reason}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {resolution.resolved_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Resolved at {format(new Date(resolution.resolved_at), 'PPpp')}
                </div>
              )}
            </CardContent>
          </Card>

          {autonomyEnvelope && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Autonomy Envelope Used
                  {autonomyEnvelope.is_active ? (
                    <Badge className="bg-green-500/20 text-green-700">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium">Envelope Name</h4>
                  <p className="text-sm text-muted-foreground">{autonomyEnvelope.envelope_name}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Allowed Intent Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {autonomyEnvelope.allowed_intent_types.map((type, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Impact Limits</h4>
                  {Object.keys(autonomyEnvelope.max_impact).length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(autonomyEnvelope.max_impact).map(([key, value]) => (
                        <div key={key} className="text-sm bg-muted p-2 rounded">
                          <span className="text-muted-foreground">{key}:</span>{' '}
                          <span className="font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No limits defined</span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Required Evidence</h4>
                  {autonomyEnvelope.required_evidence.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {autonomyEnvelope.required_evidence.map((evidence, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {evidence}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No evidence required</span>
                  )}
                </div>

                {autonomyEnvelope.valid_until && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Valid until {format(new Date(autonomyEnvelope.valid_until), 'PPpp')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!resolution && !error && !isSearching && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileSearch className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Enter an Intent ID to inspect its resolution</p>
            <p className="text-xs mt-1">See why the system made a decision</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
