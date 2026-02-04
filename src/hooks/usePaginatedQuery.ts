// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATED QUERY HOOK — Scalable pagination pattern for all large datasets
// Follows Dynasty OS Pagination & Verification Contract
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface PaginationControls {
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  goToFirst: () => void;
  goToLast: () => void;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationState;
  controls: PaginationControls;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  // Verification data
  verification: {
    showingFrom: number;
    showingTo: number;
    isComplete: boolean;
  };
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Calculate pagination range for Supabase .range() calls
 */
export function calculateRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

/**
 * Hook for managing pagination state
 */
export function usePaginationState(initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = useMemo(() => 
    Math.max(1, Math.ceil(totalCount / pageSize)), 
    [totalCount, pageSize]
  );

  const controls: PaginationControls = useMemo(() => ({
    goToPage: (newPage: number) => {
      setPage(Math.max(1, Math.min(newPage, totalPages)));
    },
    nextPage: () => {
      setPage(p => Math.min(p + 1, totalPages));
    },
    prevPage: () => {
      setPage(p => Math.max(p - 1, 1));
    },
    setPageSize: (newSize: number) => {
      setPageSize(newSize);
      setPage(1); // Reset to first page when changing size
    },
    goToFirst: () => setPage(1),
    goToLast: () => setPage(totalPages),
  }), [totalPages]);

  const range = useMemo(() => calculateRange(page, pageSize), [page, pageSize]);

  const verification = useMemo(() => ({
    showingFrom: totalCount > 0 ? range.from + 1 : 0,
    showingTo: Math.min(range.to + 1, totalCount),
    isComplete: totalCount <= pageSize,
  }), [range, totalCount, pageSize]);

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    controls,
    range,
    setTotalCount,
    verification,
  };
}

/**
 * Verification bar data for Dynasty OS compliance
 */
export interface VerificationBarData {
  currentPageCount: number;
  totalSystemCount: number;
  isDiscrepancy: boolean;
  message: string;
}

export function createVerificationData(
  pageData: unknown[],
  totalCount: number,
  page: number,
  pageSize: number
): VerificationBarData {
  const expectedPageCount = Math.min(pageSize, totalCount - (page - 1) * pageSize);
  const actualPageCount = pageData.length;
  const isDiscrepancy = actualPageCount !== expectedPageCount && totalCount > 0;

  return {
    currentPageCount: actualPageCount,
    totalSystemCount: totalCount,
    isDiscrepancy,
    message: isDiscrepancy 
      ? `⚠️ Discrepancy: Expected ${expectedPageCount} rows, got ${actualPageCount}`
      : `✓ Showing ${actualPageCount} of ${totalCount} total records`,
  };
}
