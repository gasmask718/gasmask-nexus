// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL SELECTOR COMPONENT
// Dropdown to select vertical and view cross-promotion options
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle } from 'lucide-react';
import { 
  VERTICAL_LIST, 
  VERTICALS,
  type VerticalSlug,
  getCrossPromotableBrands 
} from '@/config/verticals';
import { useVerticals, useVerticalBrands } from '@/hooks/useVerticals';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalSelectorProps {
  value: VerticalSlug | null;
  onChange: (value: VerticalSlug) => void;
  disabled?: boolean;
  className?: string;
}

export function VerticalSelector({
  value,
  onChange,
  disabled = false,
  className,
}: VerticalSelectorProps) {
  const { data: verticals, isLoading } = useVerticals();
  
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as VerticalSlug)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="Select vertical..." />
      </SelectTrigger>
      <SelectContent>
        {VERTICAL_LIST.map((vertical) => {
          const Icon = vertical.icon;
          return (
            <SelectItem key={vertical.slug} value={vertical.slug}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: vertical.color }} />
                <span>{vertical.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND SELECTOR WITH VERTICAL ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

interface BrandSelectorWithVerticalProps {
  verticalSlug: VerticalSlug | null;
  selectedBrands: string[];
  onChange: (brands: string[]) => void;
  className?: string;
}

export function BrandSelectorWithVertical({
  verticalSlug,
  selectedBrands,
  onChange,
  className,
}: BrandSelectorWithVerticalProps) {
  const { data: verticals } = useVerticals();
  
  // Get vertical ID from slug
  const verticalId = verticals?.find(v => v.slug === verticalSlug)?.id || null;
  const { data: brands, isLoading } = useVerticalBrands(verticalId);
  
  // Get static config for this vertical
  const vertical = verticalSlug ? VERTICALS[verticalSlug] : null;
  
  const handleToggle = (brandId: string) => {
    if (selectedBrands.includes(brandId)) {
      onChange(selectedBrands.filter(b => b !== brandId));
    } else {
      onChange([...selectedBrands, brandId]);
    }
  };
  
  if (!verticalSlug) {
    return (
      <Card className={cn('bg-muted/30', className)}>
        <CardContent className="py-6 text-center text-muted-foreground">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a vertical first to see available brands</p>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <Card className={cn('bg-muted/30', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">Loading brands...</p>
        </CardContent>
      </Card>
    );
  }
  
  const allowedBrands = vertical?.brands || [];
  const forbiddenBrands = vertical?.forbiddenBrands || [];
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {vertical && (
            <>
              <vertical.icon className="w-4 h-4" style={{ color: vertical.color }} />
              {vertical.name} Brands
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40">
          <div className="space-y-3">
            {/* Allowed brands from DB */}
            {brands?.map((brand) => (
              <div key={brand.id} className="flex items-center space-x-2">
                <Checkbox
                  id={brand.id}
                  checked={selectedBrands.includes(brand.brand_id)}
                  onCheckedChange={() => handleToggle(brand.brand_id)}
                />
                <Label
                  htmlFor={brand.id}
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  {brand.brand_name}
                  {brand.can_cross_promote && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      cross-promote
                    </Badge>
                  )}
                </Label>
              </div>
            ))}
            
            {/* Fallback to static config if no DB brands */}
            {(!brands || brands.length === 0) && allowedBrands.map((brandId) => (
              <div key={brandId} className="flex items-center space-x-2">
                <Checkbox
                  id={brandId}
                  checked={selectedBrands.includes(brandId)}
                  onCheckedChange={() => handleToggle(brandId)}
                />
                <Label
                  htmlFor={brandId}
                  className="text-sm font-normal cursor-pointer"
                >
                  {brandId}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Forbidden brands warning */}
        {forbiddenBrands.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Cannot pitch in this vertical:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {forbiddenBrands.map(brand => (
                <Badge key={brand} variant="outline" className="text-xs text-red-600 border-red-300">
                  {brand}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERTICAL + BRAND COMBO SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

interface VerticalBrandComboProps {
  selectedVertical: VerticalSlug | null;
  onVerticalChange: (vertical: VerticalSlug) => void;
  selectedBrands: string[];
  onBrandsChange: (brands: string[]) => void;
  className?: string;
}

export function VerticalBrandCombo({
  selectedVertical,
  onVerticalChange,
  selectedBrands,
  onBrandsChange,
  className,
}: VerticalBrandComboProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label className="text-sm font-medium mb-2 block">Vertical</Label>
        <VerticalSelector
          value={selectedVertical}
          onChange={(v) => {
            onVerticalChange(v);
            // Clear brands when vertical changes
            onBrandsChange([]);
          }}
        />
      </div>
      
      <BrandSelectorWithVertical
        verticalSlug={selectedVertical}
        selectedBrands={selectedBrands}
        onChange={onBrandsChange}
      />
    </div>
  );
}

export default VerticalSelector;
