import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  getBusinessSummary,
  getPersonalSpendingSummary,
  addBusinessTransaction,
  addPersonalTransaction,
  addBusinessExpense,
  getBusinessExpenses,
  getPayrollRecords,
  createPayrollRecord,
  updatePayrollStatus,
  getSubscriptions,
  addSubscription,
  getFinancialInsights,
  getBudgetProfiles,
  getNetWorthSnapshots,
  getFinancialDashboardStats,
  BusinessTransaction,
  PersonalTransaction,
} from '@/services/financialEngine';

export function useFinancialEngine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Business Summary
  const useBusinessSummary = (startDate: string, endDate: string) => {
    return useQuery({
      queryKey: ['business-summary', startDate, endDate],
      queryFn: () => getBusinessSummary(startDate, endDate),
      enabled: !!startDate && !!endDate,
    });
  };

  // Personal Spending Summary
  const usePersonalSummary = (userId: string, startDate: string, endDate: string) => {
    return useQuery({
      queryKey: ['personal-summary', userId, startDate, endDate],
      queryFn: () => getPersonalSpendingSummary(userId, startDate, endDate),
      enabled: !!userId && !!startDate && !!endDate,
    });
  };

  // Add Business Transaction
  const addBusinessTransactionMutation = useMutation({
    mutationFn: addBusinessTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-summary'] });
      queryClient.invalidateQueries({ queryKey: ['business-transactions'] });
      toast({ title: 'Transaction added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding transaction', description: error.message, variant: 'destructive' });
    },
  });

  // Add Personal Transaction
  const addPersonalTransactionMutation = useMutation({
    mutationFn: addPersonalTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-summary'] });
      queryClient.invalidateQueries({ queryKey: ['personal-transactions'] });
      toast({ title: 'Transaction added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding transaction', description: error.message, variant: 'destructive' });
    },
  });

  // Add Business Expense
  const addBusinessExpenseMutation = useMutation({
    mutationFn: addBusinessExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['business-summary'] });
      toast({ title: 'Expense added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding expense', description: error.message, variant: 'destructive' });
    },
  });

  return {
    useBusinessSummary,
    usePersonalSummary,
    addBusinessTransaction: addBusinessTransactionMutation.mutate,
    addPersonalTransaction: addPersonalTransactionMutation.mutate,
    addBusinessExpense: addBusinessExpenseMutation.mutate,
    isLoading: addBusinessTransactionMutation.isPending || addPersonalTransactionMutation.isPending,
  };
}

export function useBusinessExpenses(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['business-expenses', startDate, endDate],
    queryFn: () => getBusinessExpenses(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function usePayroll() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const payrollQuery = useQuery({
    queryKey: ['payroll-records'],
    queryFn: () => getPayrollRecords(),
  });

  const createMutation = useMutation({
    mutationFn: createPayrollRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      toast({ title: 'Payroll record created' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updatePayrollStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      toast({ title: 'Payroll status updated' });
    },
  });

  return {
    payroll: payrollQuery.data || [],
    isLoading: payrollQuery.isLoading,
    createPayroll: createMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
  };
}

export function useSubscriptions(isBusiness?: boolean) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['subscriptions', isBusiness],
    queryFn: () => getSubscriptions(isBusiness),
  });

  const addMutation = useMutation({
    mutationFn: addSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({ title: 'Subscription added' });
    },
  });

  return {
    subscriptions: query.data || [],
    isLoading: query.isLoading,
    addSubscription: addMutation.mutate,
  };
}

export function useFinancialInsights() {
  return useQuery({
    queryKey: ['financial-insights'],
    queryFn: () => getFinancialInsights('active'),
  });
}

export function useBudgets(profileType?: string) {
  return useQuery({
    queryKey: ['budget-profiles', profileType],
    queryFn: () => getBudgetProfiles(profileType),
  });
}

export function useNetWorth(userId: string) {
  return useQuery({
    queryKey: ['networth', userId],
    queryFn: () => getNetWorthSnapshots(userId),
    enabled: !!userId,
  });
}

export function useFinancialDashboard() {
  return useQuery({
    queryKey: ['financial-dashboard'],
    queryFn: getFinancialDashboardStats,
    refetchInterval: 60000, // Refresh every minute
  });
}
