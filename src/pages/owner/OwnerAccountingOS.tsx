// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY ACCOUNTING OS — Global Multi-Business Financial Intelligence (Penthouse)
// Three-tier architecture: Global Intelligence → Business Ledger → Personal Finance
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calculator, Sun, Crown, Calendar, Receipt,
  BarChart3, Shield, Users, Upload, Wallet,
  PiggyBank, Banknote, Target, FileText, TrendingUp,
  Globe, Building2, Factory, Activity, Search, Signal,
} from 'lucide-react';

// Global Intelligence Views
import {
  GlobalOverview,
  BusinessComparison,
  IndustryView,
  CashflowTimeline,
  ExpenseIntelligence,
  CashflowReadiness,
} from '@/components/accounting/global';

// Business Ledger Views
import AccountingDailyBriefing from '@/components/accounting/AccountingDailyBriefing';
import TopSpendersReport from '@/components/accounting/TopSpendersReport';
import CollectionsCalendar from '@/components/accounting/CollectionsCalendar';
import ExpensesHub from '@/components/accounting/ExpensesHub';
import AccountingReports from '@/components/accounting/AccountingReports';
import TaxPrepVault from '@/components/accounting/TaxPrepVault';
import StatementUploader from '@/components/accounting/StatementUploader';

// Personal Finance Views
import {
  PersonalDashboard,
  PersonalExpenses,
  PersonalIncome,
  PersonalBudget,
  PersonalTaxes,
  PersonalNetWorth,
} from '@/components/accounting/personal';

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
              CPA-grade financial intelligence — multi-business, multi-industry command center
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="border-emerald-500/60 bg-emerald-900/40 text-emerald-200 px-3 py-1">
            <Crown className="h-3 w-3 mr-1" />
            DYNASTY FINANCE
          </Badge>
          <Badge variant="outline" className="border-blue-500/60 bg-blue-900/40 text-blue-200 px-3 py-1">
            <Shield className="h-3 w-3 mr-1" />
            SEPARATE LEDGERS
          </Badge>
          <Badge variant="outline" className="border-purple-500/60 bg-purple-900/40 text-purple-200 px-3 py-1">
            <Globe className="h-3 w-3 mr-1" />
            MULTI-ENTITY
          </Badge>
        </div>
      </div>

      {/* Top-Level Tier Selection */}
      <Tabs defaultValue="global" className="space-y-4">
        <TabsList className="bg-muted/60 h-auto p-1.5 gap-1">
          <TabsTrigger value="global" className="gap-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-200 px-4 py-2">
            <Globe className="h-4 w-4" />
            Global Intelligence
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-200 px-4 py-2">
            <BarChart3 className="h-4 w-4" />
            Business Ledger
          </TabsTrigger>
          <TabsTrigger value="personal" className="gap-1.5 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-200 px-4 py-2">
            <Wallet className="h-4 w-4" />
            Personal Finance
          </TabsTrigger>
        </TabsList>

        {/* ═══ GLOBAL INTELLIGENCE ═══ */}
        <TabsContent value="global">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-purple-500/20">
                <Globe className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Comparison
              </TabsTrigger>
              <TabsTrigger value="industry" className="gap-1.5">
                <Factory className="h-3.5 w-3.5" />
                Industry
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Cashflow
              </TabsTrigger>
              <TabsTrigger value="expense-intel" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Expense Intel
              </TabsTrigger>
              <TabsTrigger value="readiness" className="gap-1.5">
                <Signal className="h-3.5 w-3.5" />
                Readiness
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><GlobalOverview /></TabsContent>
            <TabsContent value="comparison"><BusinessComparison /></TabsContent>
            <TabsContent value="industry"><IndustryView /></TabsContent>
            <TabsContent value="cashflow"><CashflowTimeline /></TabsContent>
            <TabsContent value="expense-intel"><ExpenseIntelligence /></TabsContent>
            <TabsContent value="readiness"><CashflowReadiness /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ BUSINESS LEDGER ═══ */}
        <TabsContent value="business">
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
              <TabsTrigger value="statements" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Statements
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

            <TabsContent value="briefing"><AccountingDailyBriefing /></TabsContent>
            <TabsContent value="spenders"><TopSpendersReport /></TabsContent>
            <TabsContent value="collections"><CollectionsCalendar /></TabsContent>
            <TabsContent value="expenses"><ExpensesHub /></TabsContent>
            <TabsContent value="statements"><StatementUploader /></TabsContent>
            <TabsContent value="reports"><AccountingReports /></TabsContent>
            <TabsContent value="tax"><TaxPrepVault /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ PERSONAL FINANCE ═══ */}
        <TabsContent value="personal">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-muted/50 flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-blue-500/20">
                <TrendingUp className="h-3.5 w-3.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="expenses" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="income" className="gap-1.5">
                <Banknote className="h-3.5 w-3.5" />
                Income
              </TabsTrigger>
              <TabsTrigger value="budget" className="gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Budget
              </TabsTrigger>
              <TabsTrigger value="taxes" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Taxes
              </TabsTrigger>
              <TabsTrigger value="networth" className="gap-1.5">
                <PiggyBank className="h-3.5 w-3.5" />
                Net Worth
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard"><PersonalDashboard /></TabsContent>
            <TabsContent value="expenses"><PersonalExpenses /></TabsContent>
            <TabsContent value="income"><PersonalIncome /></TabsContent>
            <TabsContent value="budget"><PersonalBudget /></TabsContent>
            <TabsContent value="taxes"><PersonalTaxes /></TabsContent>
            <TabsContent value="networth"><PersonalNetWorth /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
