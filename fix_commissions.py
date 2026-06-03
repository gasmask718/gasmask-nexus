import re

with open('src/pages/ambassador/AmbassadorCommissions.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace(
    "import { useTranslation } from '@/hooks/useTranslation';",
    "import { useTranslation } from '@/hooks/useTranslation';\nimport { BilingualLabel } from '@/components/portal/BilingualLabel';"
)

# Summary Cards
content = content.replace('<p className="text-sm text-muted-foreground">Pending</p>', '<p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.kpi.pending" en="Pending" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">{totals.pending_count} entries</p>', '<p className="text-xs text-muted-foreground">{totals.pending_count} {t(\'amb.kpi.entries\')}</p>')
content = content.replace('<p className="text-sm text-muted-foreground">Approved</p>', '<p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.kpi.approved" en="Approved" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">{totals.approved_count} entries</p>', '<p className="text-xs text-muted-foreground">{totals.approved_count} {t(\'amb.kpi.entries\')}</p>')
content = content.replace('<p className="text-sm text-muted-foreground">Paid (Lifetime)</p>', '<p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.kpi.paid_lifetime" en="Paid (Lifetime)" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">{totals.paid_count} entries</p>', '<p className="text-xs text-muted-foreground">{totals.paid_count} {t(\'amb.kpi.entries\')}</p>')
content = content.replace('<p className="text-sm text-muted-foreground">Lifetime Total</p>', '<p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.kpi.lifetime_total" en="Lifetime Total" /></p>')

# Earnings by Channel
content = content.replace('<CardTitle className="text-lg">Earnings by Channel</CardTitle>', '<CardTitle className="text-lg"><BilingualLabel tKey="amb.commissions.earnings_by_channel" en="Earnings by Channel" /></CardTitle>')
content = content.replace('<CardDescription>Commission breakdown by source type</CardDescription>', '<CardDescription><BilingualLabel tKey="amb.commissions.channel_breakdown" en="Commission breakdown by source type" /></CardDescription>')
content = content.replace('<p className="text-xs text-muted-foreground">Store Orders</p>', '<p className="text-xs text-muted-foreground"><BilingualLabel tKey="amb.commissions.store_orders" en="Store Orders" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">Wholesale</p>', '<p className="text-xs text-muted-foreground"><BilingualLabel tKey="amb.commissions.wholesale" en="Wholesale" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">Affiliate</p>', '<p className="text-xs text-muted-foreground"><BilingualLabel tKey="amb.commissions.affiliate" en="Affiliate" /></p>')
content = content.replace('<p className="text-xs text-muted-foreground">Team Override</p>', '<p className="text-xs text-muted-foreground"><BilingualLabel tKey="amb.commissions.team_override" en="Team Override" /></p>')

# Tabs
content = content.replace('<TabsTrigger value="ledger">Commission Ledger</TabsTrigger>', '<TabsTrigger value="ledger"><BilingualLabel tKey="amb.commissions.commission_ledger" en="Commission Ledger" /></TabsTrigger>')
content = content.replace('<TabsTrigger value="payouts">Payout History</TabsTrigger>', '<TabsTrigger value="payouts"><BilingualLabel tKey="amb.commissions.payout_history" en="Payout History" /></TabsTrigger>')

# Filters
content = content.replace('placeholder="Search by store or source ID..."', 'placeholder={t(\'amb.commissions.search_ledger\')}')
content = content.replace('<SelectValue placeholder="Channel" />', '<SelectValue placeholder={t(\'amb.commissions.channel\')} />')
content = content.replace('<SelectItem value="all">All Channels</SelectItem>', '<SelectItem value="all">{t(\'amb.commissions.all_channels\')}</SelectItem>')
content = content.replace('<SelectItem value="store_order">Store Orders</SelectItem>', '<SelectItem value="store_order">{t(\'amb.commissions.store_orders\')}</SelectItem>')
content = content.replace('<SelectItem value="wholesale_order">Wholesale</SelectItem>', '<SelectItem value="wholesale_order">{t(\'amb.commissions.wholesale\')}</SelectItem>')
content = content.replace('<SelectItem value="affiliate">Affiliate</SelectItem>', '<SelectItem value="affiliate">{t(\'amb.commissions.affiliate\')}</SelectItem>')
content = content.replace('<SelectItem value="team_override">Team Override</SelectItem>', '<SelectItem value="team_override">{t(\'amb.commissions.team_override\')}</SelectItem>')
content = content.replace('<SelectValue placeholder="Status" />', '<SelectValue placeholder={t(\'amb.commissions.status\')} />')
content = content.replace('<SelectItem value="all">All Status</SelectItem>', '<SelectItem value="all">{t(\'amb.commissions.all_status\')}</SelectItem>')
content = content.replace('<SelectItem value="pending">Pending</SelectItem>', '<SelectItem value="pending">{t(\'amb.status.pending\')}</SelectItem>')
content = content.replace('<SelectItem value="approved">Approved</SelectItem>', '<SelectItem value="approved">{t(\'amb.status.approved\')}</SelectItem>')
content = content.replace('<SelectItem value="paid">Paid</SelectItem>', '<SelectItem value="paid">{t(\'amb.status.paid\')}</SelectItem>')
content = content.replace('<SelectItem value="reversed">Reversed</SelectItem>', '<SelectItem value="reversed">{t(\'amb.status.reversed\')}</SelectItem>')

# CSV Export
content = content.replace(
    "const header = ['Date','Store/Source','Channel','Gross','Rate (%)','Commission','Status','Reversal Of'];",
    "const header = [t('amb.commissions.earned'), t('amb.commissions.store_or_source'), t('amb.commissions.channel'), t('amb.commissions.gross'), t('amb.commissions.rate'), t('amb.commissions.commission'), t('amb.commissions.status'), t('amb.commissions.reversal')];"
)

# Table Ledger
content = content.replace('<TableHead>Store / Source</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.store_or_source" en="Store / Source" /></TableHead>')
content = content.replace('<TableHead>Channel</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.channel" en="Channel" /></TableHead>')
content = content.replace('<TableHead className="text-right">Gross</TableHead>', '<TableHead className="text-right"><BilingualLabel tKey="amb.commissions.gross" en="Gross" /></TableHead>')
content = content.replace('<TableHead className="text-right">Rate</TableHead>', '<TableHead className="text-right"><BilingualLabel tKey="amb.commissions.rate" en="Rate" /></TableHead>')
content = content.replace('<TableHead className="text-right">Commission</TableHead>', '<TableHead className="text-right"><BilingualLabel tKey="amb.commissions.commission" en="Commission" /></TableHead>')
content = content.replace('<TableHead>Status</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.status" en="Status" /></TableHead>')
content = content.replace('<TableHead>Earned</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.earned" en="Earned" /></TableHead>')
content = content.replace('{entry.reversal_of && <span className="text-red-500 ml-1">(Reversal)</span>}', '{entry.reversal_of && <span className="text-red-500 ml-1">({t(\'amb.commissions.reversal\')})</span>}')

# Empty states
content = content.replace(
    "'{ledger.length === 0 \\n                             ? \\'No commission entries yet. Start earning by completing store orders!\\'\\n                             : \\'No entries match your filters\\'}'",
    "ledger.length === 0 ? t('amb.commissions.no_entries_yet') : t('amb.commissions.no_match_filters')"
)
# Fix for the above replacement (new lines in source)
content = re.sub(
    r"\{\s*ledger\.length\s*===\s*0\s*\?\s*'No commission entries yet\. Start earning by completing store orders!'\s*:\s*'No entries match your filters'\s*\}",
    "ledger.length === 0 ? t('amb.commissions.no_entries_yet') : t('amb.commissions.no_match_filters')",
    content
)

# Payout History
content = content.replace(
    '<Receipt className="h-5 w-5" />\n                  Payout History',
    '<Receipt className="h-5 w-5" />\n                  <BilingualLabel tKey="amb.commissions.payout_history" en="Payout History" />'
)
content = content.replace('<CardDescription>\n                  All completed payout batches and statements\n                </CardDescription>', '<CardDescription>\n                  <BilingualLabel tKey="amb.commissions.payouts_desc" en="All completed payout batches and statements" />\n                </CardDescription>')
content = content.replace('<TableHead>Period</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.period" en="Period" /></TableHead>')
content = content.replace('<TableHead className="text-right">Amount</TableHead>', '<TableHead className="text-right"><BilingualLabel tKey="amb.commissions.amount" en="Amount" /></TableHead>')
# Note: Status is already replaced above for TableHead if it matches. Let's check.
# The previous replace for <TableHead>Status</TableHead> will hit both tables if they are identical.
content = content.replace('<TableHead>Paid Date</TableHead>', '<TableHead><BilingualLabel tKey="amb.commissions.paid_date" en="Paid Date" /></TableHead>')

content = re.sub(
    r"\{\s*payouts\.length\s*===\s*0\s*&&\s*\(\s*<TableRow>[\s\S]*?No payouts yet\. Approved commissions will be batched for payment\.[\s\S]*?</TableRow>\s*\)\s*\}",
    "{payouts.length === 0 && (\n                      <TableRow>\n                        <TableCell colSpan={4} className=\"text-center py-8 text-muted-foreground\">\n                          {t('amb.commissions.no_payouts')}\n                        </TableCell>\n                      </TableRow>\n                    )}",
    content
)

with open('src/pages/ambassador/AmbassadorCommissions.tsx', 'w') as f:
    f.write(content)
