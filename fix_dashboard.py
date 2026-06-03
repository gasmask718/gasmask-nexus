import re

with open('src/pages/ambassador/AmbassadorDashboard.tsx', 'r') as f:
    content = f.read()

# Fix missing curly braces
content = content.replace(
    't("amb.dashboard.viewing_portfolio", { total: metrics.totalStores, assigned: metrics.assignedStores, sourced: metrics.sourcedStores })',
    '{t("amb.dashboard.viewing_portfolio", { total: metrics.totalStores, assigned: metrics.assignedStores, sourced: metrics.sourcedStores })}'
)

# Fix LEAD_KPI_CONFIG (it's outside component, can't use t() there)
# First, revert the wrong replacement if it happened
content = content.replace("label: t('amb.lead.store_leads'),", "label: 'Store Leads',")
content = content.replace("label: t('amb.lead.wholesaler_leads'),", "label: 'Wholesaler Leads',")
content = content.replace("label: t('amb.lead.influencer_leads'),", "label: 'Influencer / Street Team',")
content = content.replace("label: t('amb.lead.ambassador_leads'),", "label: 'Ambassador Recruits',")

# Now add tKey to the config
content = content.replace("label: 'Store Leads',", "tKey: 'amb.lead.store_leads', label: 'Store Leads',")
content = content.replace("label: 'Wholesaler Leads',", "tKey: 'amb.lead.wholesaler_leads', label: 'Wholesaler Leads',")
content = content.replace("label: 'Influencer / Street Team',", "tKey: 'amb.lead.influencer_leads', label: 'Influencer / Street Team',")
content = content.replace("label: 'Ambassador Recruits',", "tKey: 'amb.lead.ambassador_leads', label: 'Ambassador Recruits',")

# Update usage of config.label to BilingualLabel
content = content.replace(
    '<p className="text-sm text-muted-foreground">{config.label}</p>',
    '<p className="text-sm text-muted-foreground"><BilingualLabel tKey={config.tKey} en={config.label} /></p>'
)

with open('src/pages/ambassador/AmbassadorDashboard.tsx', 'w') as f:
    f.write(content)

with open('src/pages/ambassador/AmbassadorLeads.tsx', 'r') as f:
    content = f.read()

# Fix potential missing braces in Leads if any (like the one in Dashboard)
# Looking at Leads code again...
# content = content.replace('Added {format...', '{t("amb.leads.added_date", { date: format... })}') -> already has braces

with open('src/pages/ambassador/AmbassadorLeads.tsx', 'w') as f:
    f.write(content)

