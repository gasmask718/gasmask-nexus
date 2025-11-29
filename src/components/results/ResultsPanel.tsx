// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PANEL — Universal Actionable Results Panel
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ResultsPanelHeader } from './ResultsPanelHeader';
import { ResultsFilters } from './ResultsFilters';
import { ResultsTable } from './ResultsTable';
import { ResultsPanelActions, PanelType } from './ResultsPanelActions';
import { useSmartQuery, QueryDefinition } from '@/hooks/useSmartQuery';
import { QueryResult } from '@/lib/commands/CommandEngine';

interface ResultsPanelProps {
  title: string;
  type: PanelType;
  query: QueryDefinition;
  autoRun?: boolean;
  className?: string;
  onClose?: () => void;
  showMyStoresFilter?: boolean;
}

export function ResultsPanel({
  title,
  type,
  query,
  autoRun = true,
  className,
  onClose,
  showMyStoresFilter = false,
}: ResultsPanelProps) {
  const {
    data,
    loading,
    error,
    summary,
    totalCount,
    refetch,
    updateFilters,
    currentQuery,
  } = useSmartQuery(query, autoRun);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBrand, setCurrentBrand] = useState<string | undefined>(query.brand);
  const [currentStatus, setCurrentStatus] = useState<string | undefined>();

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.subtitle?.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  // Get selected results
  const selectedResults = useMemo(
    () => filteredData.filter((r) => selectedIds.has(r.id)),
    [filteredData, selectedIds]
  );

  const handleBrandChange = useCallback(
    (brand: string | undefined) => {
      setCurrentBrand(brand);
      updateFilters({ brand });
    },
    [updateFilters]
  );

  const handleStatusChange = useCallback((status: string | undefined) => {
    setCurrentStatus(status);
    // Status filtering done client-side for now
  }, []);

  const handleDateRangeChange = useCallback(
    (range: { start: Date; end: Date } | undefined) => {
      if (range) {
        updateFilters({
          dateRange: {
            start: range.start.toISOString(),
            end: range.end.toISOString(),
          },
        });
      }
    },
    [updateFilters]
  );

  const handleRowClick = useCallback((result: QueryResult) => {
    // Navigate to detail page based on type
    console.log('Row clicked:', result);
  }, []);

  const handleActionComplete = useCallback(() => {
    refetch();
    setSelectedIds(new Set());
  }, [refetch]);

  // Status options based on panel type
  const statusOptions = useMemo(() => {
    const optionsByType: Record<PanelType, { value: string; label: string }[]> = {
      stores: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'new', label: 'New' },
      ],
      deliveries: [
        { value: 'pending', label: 'Pending' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' },
      ],
      inventory: [
        { value: 'in_stock', label: 'In Stock' },
        { value: 'low', label: 'Low Stock' },
        { value: 'out', label: 'Out of Stock' },
      ],
      finance: [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'overdue', label: 'Overdue' },
      ],
      ambassadors: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      drivers: [
        { value: 'active', label: 'Active' },
        { value: 'on_route', label: 'On Route' },
        { value: 'off_duty', label: 'Off Duty' },
      ],
      wholesale: [
        { value: 'available', label: 'Available' },
        { value: 'pending', label: 'Pending' },
        { value: 'sold', label: 'Sold' },
      ],
      invoices: [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'overdue', label: 'Overdue' },
      ],
      orders: [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' },
      ],
      commissions: [
        { value: 'pending', label: 'Pending' },
        { value: 'paid', label: 'Paid' },
      ],
      routes: [
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ],
    };
    return optionsByType[type] || [];
  }, [type]);

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden rounded-xl', className)}>
      <ResultsPanelHeader
        title={title}
        summary={summary || `Loading ${type}...`}
        totalCount={totalCount}
        selectedCount={selectedIds.size}
        loading={loading}
        onRefresh={refetch}
        onClose={onClose}
      />

      <ResultsFilters
        onSearch={setSearchTerm}
        onBrandChange={handleBrandChange}
        onStatusChange={handleStatusChange}
        onDateRangeChange={handleDateRangeChange}
        currentBrand={currentBrand}
        currentStatus={currentStatus}
        showMyStoresFilter={showMyStoresFilter}
        statusOptions={statusOptions}
      />

      <ResultsTable
        data={filteredData}
        loading={loading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={handleRowClick}
      />

      <ResultsPanelActions
        panelType={type}
        selectedResults={selectedResults}
        allResults={filteredData}
        brand={currentBrand}
        onActionComplete={handleActionComplete}
      />
    </Card>
  );
}

export default ResultsPanel;
