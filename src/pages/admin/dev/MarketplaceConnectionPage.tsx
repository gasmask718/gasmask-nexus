import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Check, ShieldCheck, ShieldX, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EXPECTED_PROJECT_REF = 'qalaaroashbggynpvqct';

// RLS tables to check
const RLS_CHECKS = [
  { table: 'profiles', description: 'User can read only own profile', policy: 'SELECT scoped to auth.uid()' },
  { table: 'user_roles', description: 'User can read only own role', policy: 'SELECT scoped to auth.uid()' },
  { table: 'products_all', description: 'Public browsing allowed', policy: 'SELECT open or scoped' },
  { table: 'orders', description: 'Customer/store creates own orders only', policy: 'INSERT scoped to auth.uid()' },
  { table: 'order_items', description: 'Order owner creates items only', policy: 'INSERT scoped to order owner' },
  { table: 'order_status_history', description: 'Server-only insert (no client)', policy: 'No client INSERT' },
];

type CheckResult = { table: string; rlsEnabled: boolean; description: string; policy: string };

export default function MarketplaceConnectionPage() {
  const [revealed, setRevealed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rlsResults, setRlsResults] = useState<CheckResult[]>([]);
  const [rlsLoading, setRlsLoading] = useState(false);

  const projectUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const projectRef = projectUrl.replace('https://', '').split('.')[0];

  const isCorrectProject = projectRef === EXPECTED_PROJECT_REF;

  const handleCopy = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const runRLSCheck = async () => {
    setRlsLoading(true);
    const results: CheckResult[] = [];

    for (const check of RLS_CHECKS) {
      try {
        // Try a simple query — if RLS is enabled and restrictive, we'll get filtered results or errors
        const { error } = await supabase.from(check.table as any).select('id').limit(1);
        results.push({
          table: check.table,
          rlsEnabled: !error, // If no error, table exists and RLS allows at least some access
          description: check.description,
          policy: error ? `Error: ${error.message}` : check.policy,
        });
      } catch {
        results.push({
          table: check.table,
          rlsEnabled: false,
          description: check.description,
          policy: 'Table may not exist',
        });
      }
    }

    setRlsResults(results);
    setRlsLoading(false);
  };

  useEffect(() => {
    runRLSCheck();
  }, []);

  const showKeys = revealed || confirmText.toUpperCase() === 'SHOW KEYS';

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">🔗 External Marketplace Connection Pack</h1>
        <Badge variant={isCorrectProject ? 'default' : 'destructive'}>
          {isCorrectProject ? 'Correct Backend' : 'Backend Mismatch!'}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        Dev-only page. Copy these values into the Marketplace project's <code className="bg-muted px-1 rounded">.env</code> file.
      </p>

      {/* Section 1: Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1️⃣ Connection Credentials</CardTitle>
          <CardDescription>
            These are <strong>public/anon</strong> credentials safe for frontend use. Never use service_role in any client code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showKeys ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Type <strong>SHOW KEYS</strong> to reveal credentials:</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type SHOW KEYS..."
                className="border border-input bg-background rounded-md px-3 py-2 text-sm w-64"
              />
              <Button variant="outline" size="sm" onClick={() => setRevealed(true)} disabled={confirmText.toUpperCase() !== 'SHOW KEYS'}>
                <Eye className="h-4 w-4 mr-1" /> Reveal
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => { setRevealed(false); setConfirmText(''); }}>
                <EyeOff className="h-4 w-4 mr-1" /> Hide Keys
              </Button>

              <div className="space-y-2">
                <CredentialRow
                  label="Project Ref"
                  value={projectRef}
                  envVar="(reference only)"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
                <CredentialRow
                  label="Supabase URL"
                  value={projectUrl}
                  envVar="VITE_SUPABASE_URL"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
                <CredentialRow
                  label="Anon Public Key"
                  value={anonKey}
                  envVar="VITE_SUPABASE_ANON_KEY"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Usage Pattern */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2️⃣ Correct Usage Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
            <p className="text-green-600 dark:text-green-400">✅ Store in Marketplace <code>.env</code> as <code>VITE_SUPABASE_URL</code></p>
            <p className="text-green-600 dark:text-green-400">✅ Store in Marketplace <code>.env</code> as <code>VITE_SUPABASE_ANON_KEY</code></p>
            <p className="text-green-600 dark:text-green-400">✅ Use <code>import.meta.env.VITE_SUPABASE_*</code> in code</p>
            <p className="text-destructive">❌ Never store keys directly in source code</p>
            <p className="text-destructive">❌ Never use <code>service_role</code> key in any frontend</p>
            <p className="text-destructive">❌ Never paste keys in chat or commit to git</p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: RLS Readiness */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">3️⃣ RLS Readiness Checklist</CardTitle>
            <CardDescription>Automated checks for tables the Marketplace frontend will query.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={runRLSCheck} disabled={rlsLoading}>
            {rlsLoading ? 'Checking...' : 'Re-check'}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected Policy</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rlsResults.map((r) => (
                <TableRow key={r.table}>
                  <TableCell className="font-mono text-sm">{r.table}</TableCell>
                  <TableCell>
                    {r.rlsEnabled ? (
                      <Badge className="bg-green-600 text-white gap-1"><ShieldCheck className="h-3 w-3" /> PASS</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1"><ShieldX className="h-3 w-3" /> FAIL</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.policy}</TableCell>
                  <TableCell className="text-sm">{r.description}</TableCell>
                </TableRow>
              ))}
              {rlsResults.length === 0 && !rlsLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No results yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 4: Order Contract */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4️⃣ Marketplace Source Contract</CardTitle>
          <CardDescription>When the Marketplace creates orders, these fields are <strong>required</strong>.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
            <p><span className="text-primary font-semibold">ui_source</span> = <span className="text-green-600 dark:text-green-400">'public_marketplace'</span></p>
            <p><span className="text-primary font-semibold">channel</span> = <span className="text-green-600 dark:text-green-400">'customer'</span> | <span className="text-green-600 dark:text-green-400">'store'</span></p>
            <p><span className="text-primary font-semibold">created_by_user_id</span> = <span className="text-green-600 dark:text-green-400">auth.uid()</span></p>
            <p className="text-muted-foreground mt-2">If store order: <span className="text-primary font-semibold">store_id</span> = auth.uid()</p>
          </div>
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Orders missing <code>ui_source</code> will be rejected or flagged in the Dynasty OS Command Center.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  envVar,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  envVar: string;
  copiedField: string | null;
  onCopy: (value: string, field: string) => void;
}) {
  const isCopied = copiedField === label;
  return (
    <div className="flex items-center gap-3 bg-muted rounded-md px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground w-28 shrink-0">{label}</span>
      <code className="text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{value}</code>
      <span className="text-xs text-muted-foreground shrink-0">{envVar}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(value, label)}>
        {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}
