// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION DIFF VIEW
// Human-readable before/after comparison with field highlighting
// ═══════════════════════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight, Plus, Minus, Edit2 } from 'lucide-react';

interface SubmissionDiffViewProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  changedFields?: string[];
}

interface DiffItem {
  field: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue: unknown;
  newValue: unknown;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export function SubmissionDiffView({ before, after, changedFields }: SubmissionDiffViewProps) {
  // Compute diff items
  const diffItems: DiffItem[] = [];
  
  const allFields = new Set([
    ...(before ? Object.keys(before) : []),
    ...Object.keys(after),
  ]);

  // Filter out metadata fields
  const ignoredFields = ['id', 'created_at', 'updated_at', 'store_id', 'brand_id'];

  allFields.forEach(field => {
    if (ignoredFields.includes(field)) return;
    
    const oldValue = before?.[field];
    const newValue = after[field];
    
    let type: DiffItem['type'] = 'unchanged';
    
    if (before === null || !(field in (before || {}))) {
      if (newValue !== null && newValue !== undefined) {
        type = 'added';
      }
    } else if (!(field in after)) {
      type = 'removed';
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      type = 'changed';
    }
    
    // Only show changed fields by default, or use changedFields hint
    if (changedFields?.length) {
      if (changedFields.includes(field)) {
        diffItems.push({ field, type: type === 'unchanged' ? 'changed' : type, oldValue, newValue });
      }
    } else if (type !== 'unchanged') {
      diffItems.push({ field, type, oldValue, newValue });
    }
  });

  if (diffItems.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-4 text-center">
        No changes detected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Changed Fields Summary */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {diffItems.map(item => (
          <Badge 
            key={item.field}
            variant="outline"
            className={cn(
              "text-xs",
              item.type === 'added' && "border-green-500 text-green-600 bg-green-500/10",
              item.type === 'removed' && "border-destructive text-destructive bg-destructive/10",
              item.type === 'changed' && "border-amber-500 text-amber-600 bg-amber-500/10"
            )}
          >
            {item.type === 'added' && <Plus className="h-3 w-3 mr-1" />}
            {item.type === 'removed' && <Minus className="h-3 w-3 mr-1" />}
            {item.type === 'changed' && <Edit2 className="h-3 w-3 mr-1" />}
            {formatFieldName(item.field)}
          </Badge>
        ))}
      </div>

      {/* Detailed Diff */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground w-1/4">Field</th>
              <th className="text-left p-2 font-medium text-muted-foreground w-[37.5%]">Before</th>
              <th className="text-center p-2 w-8"></th>
              <th className="text-left p-2 font-medium text-muted-foreground w-[37.5%]">After</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {diffItems.map(item => (
              <tr 
                key={item.field}
                className={cn(
                  "transition-colors",
                  item.type === 'added' && "bg-green-500/5",
                  item.type === 'removed' && "bg-destructive/5",
                  item.type === 'changed' && "bg-amber-500/5"
                )}
              >
                <td className="p-2 font-medium">
                  {formatFieldName(item.field)}
                </td>
                <td className={cn(
                  "p-2 font-mono text-xs",
                  (item.type === 'removed' || item.type === 'changed') && "text-destructive line-through"
                )}>
                  {item.type !== 'added' ? formatValue(item.oldValue) : '—'}
                </td>
                <td className="p-2 text-center">
                  <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                </td>
                <td className={cn(
                  "p-2 font-mono text-xs",
                  (item.type === 'added' || item.type === 'changed') && "text-green-600 font-semibold"
                )}>
                  {item.type !== 'removed' ? formatValue(item.newValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
