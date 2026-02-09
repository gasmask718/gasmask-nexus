/**
 * Signal Scanner Panel — Floor signal emission controls
 * Phase 2.1: Finance signal (unpaid invoices)
 * Phase 2.3: CRM inactivity signal (high-value clients)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Radar,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type { SignalScanResponse } from '@/hooks/useFinanceSignal';
import type { CRMSignalScanResponse } from '@/hooks/useCRMSignal';

interface SignalScannerPanelProps {
  onRunFinanceScan: () => void;
  isFinanceScanning: boolean;
  financeResult: SignalScanResponse | null;
  onRunCRMScan: () => void;
  isCRMScanning: boolean;
  crmResult: CRMSignalScanResponse | null;
}

function ScanResultDisplay({ result }: { result: { signals_detected: number; missions_created: number; duplicates_found: number; results: Array<{ action: string; details: string }> } }) {
  return (
    <div className="p-3 rounded-lg border bg-background space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
        Last Scan Result
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold">{result.signals_detected}</p>
          <p className="text-[10px] text-muted-foreground">Signals</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-400">
            {result.missions_created}
          </p>
          <p className="text-[10px] text-muted-foreground">Created</p>
        </div>
        <div>
          <p className="text-lg font-bold text-muted-foreground">
            {result.duplicates_found}
          </p>
          <p className="text-[10px] text-muted-foreground">Already Tracked</p>
        </div>
      </div>
      {result.results.length > 0 && (
        <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
          {result.results.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[11px] py-1 border-t first:border-0"
            >
              {r.action === 'mission_created' ? (
                <ArrowRight className="h-3 w-3 text-green-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate text-muted-foreground">{r.details}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignalScannerPanel({
  onRunFinanceScan,
  isFinanceScanning,
  financeResult,
  onRunCRMScan,
  isCRMScanning,
  crmResult,
}: SignalScannerPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          Floor Signals
          <Badge variant="outline" className="text-[10px] ml-auto">Phase 2</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Finance Signal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Floor 5 — Finance</p>
                <p className="text-[11px] text-muted-foreground">
                  Unpaid invoices &gt; 30 days overdue
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRunFinanceScan}
              disabled={isFinanceScanning}
            >
              {isFinanceScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Radar className="h-3.5 w-3.5 mr-1.5" />
                  Scan
                </>
              )}
            </Button>
          </div>
          {financeResult && <ScanResultDisplay result={financeResult} />}
        </div>

        {/* CRM Inactivity Signal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Floor 1 — CRM</p>
                <p className="text-[11px] text-muted-foreground">
                  High-value clients inactive &gt; 30 days
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRunCRMScan}
              disabled={isCRMScanning}
            >
              {isCRMScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Radar className="h-3.5 w-3.5 mr-1.5" />
                  Scan
                </>
              )}
            </Button>
          </div>
          {crmResult && <ScanResultDisplay result={crmResult} />}
        </div>
      </CardContent>
    </Card>
  );
}
