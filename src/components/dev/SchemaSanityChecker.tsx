import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Database, X } from 'lucide-react';

interface ColumnCheck {
  table: string;
  column: string;
  exists: boolean;
}

interface TableCheck {
  table: string;
  exists: boolean;
  columns: ColumnCheck[];
}

// Canonical table contract — columns required by BOTH projects
const SCHEMA_CONTRACT: Record<string, string[]> = {
  profiles: ['id', 'role', 'full_name', 'email'],
  orders: ['id', 'created_at', 'order_status', 'payment_status'],
  marketplace_orders: ['id', 'wholesaler_id', 'customer_email', 'payment_status', 'fulfillment_status', 'created_at'],
  marketplace_order_items: ['id', 'order_id', 'product_id', 'qty', 'price_each'],
  products_all: ['id', 'product_name', 'wholesaler_id', 'retail_price', 'inventory_qty', 'status'],
  wholesaler_profiles: ['id', 'user_id', 'company_name', 'commission_percent', 'status'],
  wholesaler_payouts: ['id', 'wholesaler_id', 'amount', 'status'],
};

async function checkTable(table: string, expectedColumns: string[]): Promise<TableCheck> {
  // Try a minimal query to see if the table exists and which columns resolve
  const columnChecks: ColumnCheck[] = [];

  try {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(expectedColumns.join(','))
      .limit(0);

    if (error) {
      // Table might not exist or columns missing
      // Try just the table
      const { error: tableError } = await (supabase as any).from(table).select('id').limit(0);
      if (tableError) {
        return { table, exists: false, columns: expectedColumns.map(c => ({ table, column: c, exists: false })) };
      }

      // Table exists but some columns missing — check individually
      for (const col of expectedColumns) {
        const { error: colError } = await (supabase as any).from(table).select(col).limit(0);
        columnChecks.push({ table, column: col, exists: !colError });
      }
      return { table, exists: true, columns: columnChecks };
    }

    return {
      table,
      exists: true,
      columns: expectedColumns.map(c => ({ table, column: c, exists: true })),
    };
  } catch {
    return { table, exists: false, columns: expectedColumns.map(c => ({ table, column: c, exists: false })) };
  }
}

export function SchemaSanityChecker() {
  const [results, setResults] = useState<TableCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Only in dev
  if (!import.meta.env.DEV) return null;

  const runCheck = async () => {
    setLoading(true);
    const checks: TableCheck[] = [];
    for (const [table, columns] of Object.entries(SCHEMA_CONTRACT)) {
      checks.push(await checkTable(table, columns));
    }
    setResults(checks);
    setLoading(false);
    setHasRun(true);

    // Console output for visibility
    const failures = checks.flatMap(t =>
      t.columns.filter(c => !c.exists).map(c => `${t.table}.${c.column}`)
    );
    const missingTables = checks.filter(t => !t.exists).map(t => t.table);

    if (missingTables.length > 0) {
      console.error(`[SCHEMA SANITY] Missing tables: ${missingTables.join(', ')}`);
    }
    if (failures.length > 0) {
      console.error(`[SCHEMA SANITY] Missing columns: ${failures.join(', ')}`);
    }
    if (failures.length === 0 && missingTables.length === 0) {
      console.log('[SCHEMA SANITY] ✅ All canonical tables and columns verified.');
    }
  };

  const totalColumns = results.flatMap(t => t.columns);
  const passing = totalColumns.filter(c => c.exists).length;
  const failing = totalColumns.filter(c => !c.exists).length;

  if (!visible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setVisible(true); if (!hasRun) runCheck(); }}
        className="fixed bottom-4 left-4 z-[9999] opacity-40 hover:opacity-100 transition-opacity gap-1.5"
        title="Schema Sanity Check"
      >
        <Database className="h-4 w-4" />
        {hasRun && failing > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">{failing}</Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-[9999] w-96 max-h-[70vh] overflow-auto shadow-xl border-2 bg-background/95 backdrop-blur">
      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Schema Sanity Check
          {hasRun && (
            <Badge variant={failing > 0 ? 'destructive' : 'default'} className="text-[10px]">
              {passing}/{totalColumns.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={runCheck} disabled={loading}>
            {loading ? 'Checking…' : 'Re-run'}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setVisible(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {results.map(table => (
          <div key={table.table} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {table.exists ? (
                <CheckCircle className="h-3 w-3 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-destructive" />
              )}
              <span className={table.exists ? '' : 'text-destructive'}>{table.table}</span>
              {!table.exists && <span className="text-destructive text-[10px]">(MISSING)</span>}
            </div>
            {table.exists && (
              <div className="ml-5 flex flex-wrap gap-1">
                {table.columns.map(col => (
                  <Badge
                    key={col.column}
                    variant={col.exists ? 'outline' : 'destructive'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {col.column}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        {!hasRun && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Click "Re-run" to verify schema contract
          </p>
        )}
      </CardContent>
    </Card>
  );
}
