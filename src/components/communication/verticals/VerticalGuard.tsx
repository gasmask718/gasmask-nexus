// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL GUARD COMPONENT
// Validates and enforces vertical rules in UI
// ═══════════════════════════════════════════════════════════════════════════════

import { ReactNode, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { 
  VERTICALS, 
  type VerticalSlug,
  getVerticalForBrand,
  getCrossPromotionInfo 
} from '@/config/verticals';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL GUARD - Blocks content if vertical rules violated
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalGuardProps {
  verticalSlug: VerticalSlug;
  selectedBrands: string[];
  content?: string;
  children: ReactNode;
  onViolation?: (violations: string[]) => void;
  showWarnings?: boolean;
}

export function VerticalGuard({
  verticalSlug,
  selectedBrands,
  content = '',
  children,
  onViolation,
  showWarnings = true,
}: VerticalGuardProps) {
  const violations = useMemo(() => {
    const issues: string[] = [];
    const vertical = VERTICALS[verticalSlug];
    
    if (!vertical) return issues;
    
    // Check if any selected brands are forbidden
    for (const brand of selectedBrands) {
      if (vertical.forbiddenBrands.includes(brand)) {
        issues.push(`Brand "${brand}" cannot be pitched in ${vertical.name} vertical`);
      }
    }
    
    // Check content for forbidden topics
    if (content) {
      const lowerContent = content.toLowerCase();
      for (const forbidden of vertical.forbiddenTopics) {
        if (lowerContent.includes(forbidden.toLowerCase())) {
          issues.push(`Content contains forbidden topic: "${forbidden}"`);
        }
      }
    }
    
    return issues;
  }, [verticalSlug, selectedBrands, content]);
  
  // Call violation callback
  useMemo(() => {
    if (violations.length > 0 && onViolation) {
      onViolation(violations);
    }
  }, [violations, onViolation]);
  
  if (violations.length > 0 && showWarnings) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Vertical Enforcement Blocked</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {violations.map((v, i) => (
                <li key={i} className="text-sm">{v}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL RULES DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalRulesDisplayProps {
  verticalSlug: VerticalSlug;
  compact?: boolean;
  className?: string;
}

export function VerticalRulesDisplay({
  verticalSlug,
  compact = false,
  className,
}: VerticalRulesDisplayProps) {
  const info = getCrossPromotionInfo(verticalSlug);
  const vertical = VERTICALS[verticalSlug];
  
  if (!vertical) return null;
  
  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Badge variant="outline" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          {vertical.name}
        </Badge>
        <Badge variant="secondary" className="text-xs text-green-600">
          ✓ {info.allowedBrands.length} brands allowed
        </Badge>
        <Badge variant="secondary" className="text-xs text-red-600">
          ✗ {info.forbiddenBrands.length} forbidden
        </Badge>
      </div>
    );
  }
  
  return (
    <Card className={cn('bg-muted/30', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: vertical.color }} />
          {vertical.name} Vertical Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Allowed Brands */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            ✓ Allowed Brands (Can Cross-Promote)
          </p>
          <div className="flex flex-wrap gap-1">
            {info.allowedBrands.map(brand => (
              <Badge key={brand} variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                {brand}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Forbidden Brands */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            ✗ Forbidden Brands (NEVER Pitch)
          </p>
          <div className="flex flex-wrap gap-1">
            {info.forbiddenBrands.map(brand => (
              <Badge key={brand} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                {brand}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Forbidden Topics */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            ⚠️ Forbidden Topics
          </p>
          <div className="flex flex-wrap gap-1">
            {info.forbiddenTopics.slice(0, 6).map(topic => (
              <Badge key={topic} variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                {topic}
              </Badge>
            ))}
            {info.forbiddenTopics.length > 6 && (
              <Badge variant="outline" className="text-xs">
                +{info.forbiddenTopics.length - 6} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL VALIDATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalValidationStatusProps {
  isValid: boolean;
  violations: string[];
  className?: string;
}

export function VerticalValidationStatus({
  isValid,
  violations,
  className,
}: VerticalValidationStatusProps) {
  if (isValid) {
    return (
      <div className={cn('flex items-center gap-2 text-green-600', className)}>
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm">Vertical rules passed</span>
      </div>
    );
  }
  
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">Vertical violations detected</span>
      </div>
      <ul className="list-disc list-inside text-xs text-muted-foreground">
        {violations.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </div>
  );
}

export default VerticalGuard;
