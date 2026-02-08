// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY ACCOUNTING OS — CPA-Grade Financial Command Center (Penthouse)
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calculator, Sun, Crown, Calendar, Receipt,
  BarChart3, Shield, Users,
} from 'lucide-react';

import AccountingDailyBriefing from '@/components/accounting/AccountingDailyBriefing';
import TopSpendersReport from '@/components/accounting/TopSpendersReport';
import CollectionsCalendar from '@/components/accounting/CollectionsCalendar';
import ExpensesHub from '@/components/accounting/ExpensesHub';
import AccountingReports from '@/components/accounting/AccountingReports';
import TaxPrepVault from '@/components/accounting/TaxPrepVault';

export default function OwnerAccountingOS() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 shadow-lg">
            <Calculator className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              Accounting OS
            </h1>
            <p className="text-sm text-muted-foreground">
              CPA-grade financial control center — consolidated across all businesses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="border-emerald-500/60 bg-emerald-900/40 text-emerald-200 px-3 py-1">
            <Crown className="h-3 w-3 mr-1" />
            DYNASTY FINANCE
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="briefing" className="space-y-6">
        <TabsList className="bg-muted/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="briefing" className="gap-1.5 data-[state=active]:bg-emerald-500/20">
            <Sun className="h-3.5 w-3.5" />
            Daily Briefing
          </TabsTrigger>
          <TabsTrigger value="spenders" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Top Spenders
          </TabsTrigger>
          <TabsTrigger value="collections" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Collections
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Tax Vault
          </TabsTrigger>
        </TabsList>

        <TabsContent value="briefing">
          <AccountingDailyBriefing />
        </TabsContent>

        <TabsContent value="spenders">
          <TopSpendersReport />
        </TabsContent>

        <TabsContent value="collections">
          <CollectionsCalendar />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesHub />
        </TabsContent>

        <TabsContent value="reports">
          <AccountingReports />
        </TabsContent>

        <TabsContent value="tax">
          <TaxPrepVault />
        </TabsContent>
      </Tabs>
    </div>
  );
}
