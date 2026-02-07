/**
 * Purchase Filters Bar
 * Date range, status, total range, search for purchases table
 */
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { PurchaseFilters } from '@/hooks/useAmbassadorPurchases';

interface PurchaseFiltersBarProps {
  filters: PurchaseFilters;
  onChange: (filters: PurchaseFilters) => void;
}

export function PurchaseFiltersBar({ filters, onChange }: PurchaseFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.status || 'all'}
        onValueChange={(value) => onChange({ ...filters, status: value })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="submitted">Submitted</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="fulfilled">Fulfilled</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        className="w-[150px]"
        placeholder="From"
      />

      <Input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        className="w-[150px]"
        placeholder="To"
      />
    </div>
  );
}
