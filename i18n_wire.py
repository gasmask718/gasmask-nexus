import re
import os

def wire_leads(content):
    count = 0
    # Import BilingualLabel
    if "import { BilingualLabel }" not in content:
        content = content.replace(
            "import { useTranslation } from '@/hooks/useTranslation';",
            "import { useTranslation } from '@/hooks/useTranslation';\nimport { BilingualLabel } from '@/components/portal/BilingualLabel';"
        )
    
    # title/subtitle in AmbassadorLayout
    content = content.replace(
        'title={isReadOnly && targetAmbassador ? `Pipeline for ${targetAmbassador.name || \'Ambassador\'}` : "Leads Pipeline"}',
        'title={isReadOnly && targetAmbassador ? t("amb.leads.viewing_pipeline", { name: targetAmbassador.name || "Ambassador" }) : t("amb.leads.title")}'
    )
    count += 1
    content = content.replace(
        'subtitle={isReadOnly ? "Read-only view — Leads created by this ambassador" : "Manage prospects across all channels"}',
        'subtitle={isReadOnly ? t("amb.leads.read_only") : t("amb.leads.subtitle")}'
    )
    count += 1
    
    # Read-Only Context Banner
    content = content.replace(
        '<strong>Viewing Pipeline for {targetAmbassador.name}</strong>',
        '<strong>{t("amb.leads.viewing_pipeline", { name: targetAmbassador.name })}</strong>'
    )
    count += 1
    content = content.replace(
        '<span className="ml-2 text-muted-foreground">· Read-only mode · Leads created by this ambassador</span>',
        '<span className="ml-2 text-muted-foreground">· {t("amb.leads.read_only_notice")}</span>'
    )
    count += 1
    
    # KPI names
    content = content.replace(
        '<p className="text-sm text-muted-foreground">{pipeline.name}</p>',
        '<p className="text-sm text-muted-foreground"><BilingualLabel tKey={`amb.lead.${pipeline.id.replace("s", "")}_leads`} en={pipeline.name} /></p>'
    )
    count += 1
    
    # Tabs List
    content = content.replace(
        '<span className="hidden sm:inline">{pipeline.name}</span>',
        '<span className="hidden sm:inline"><BilingualLabel tKey={`amb.lead.${pipeline.id.replace("s", "")}_leads`} en={pipeline.name} /></span>'
    )
    count += 1
    
    # Add Lead button
    content = content.replace(
        '<Plus className="h-4 w-4 mr-2" />\n                Add Lead',
        '<Plus className="h-4 w-4 mr-2" />\n                <BilingualLabel tKey="amb.leads.add_lead" en="Add Lead" inline />'
    )
    count += 1
    
    # Search placeholder
    content = content.replace(
        'placeholder={`Search ${pipeline.name.toLowerCase()}...`}',
        'placeholder={t("amb.leads.search_placeholder", { name: pipeline.name })}'
    )
    count += 1
    
    # Follow up
    content = content.replace(
        '<span className="text-primary font-medium">Follow up</span>',
        '<span className="text-primary font-medium">{t("amb.leads.follow_up_label")}</span>'
    )
    count += 1
    
    # Added date
    content = content.replace(
        'Added {format(new Date(lead.created_at), \'MMM d, yyyy\')}',
        '{t("amb.leads.added_date", { date: format(new Date(lead.created_at), "MMM d, yyyy") })}'
    )
    count += 1
    
    # No leads in stage
    content = content.replace(
        '<p className="text-sm">No leads in this stage</p>',
        '<p className="text-sm">{t("amb.leads.no_leads_in_stage")}</p>'
    )
    count += 1
    
    # Empty state title
    content = content.replace(
        '<h3 className="font-medium mb-2">No {pipeline.name}</h3>',
        '<h3 className="font-medium mb-2"><BilingualLabel tKey="amb.leads.no_leads" en={`No ${pipeline.name}`} /></h3>'
    )
    count += 1
    
    # Empty state desc
    content = content.replace(
        'isReadOnly \n                      ? \'This ambassador has not created any leads in this pipeline yet\'\n                      : \'Start building your pipeline by adding leads\'',
        'isReadOnly ? t("amb.leads.no_pipeline_other") : t("amb.leads.start_building")'
    )
    count += 1
    
    # Empty state button
    content = content.replace(
        'Add {pipeline.name.replace(\' Leads\', \'\')}',
        '<BilingualLabel tKey="amb.leads.add_type_lead" en={`Add ${pipeline.name.replace(" Leads", "")}`} inline />'
    )
    count += 1
    
    # Add New Lead Modal
    content = content.replace('<DialogTitle>Add New Lead</DialogTitle>', '<DialogTitle><BilingualLabel tKey="amb.leads.add_new" en="Add New Lead" /></DialogTitle>')
    count += 1
    content = content.replace('<DialogDescription>\n              Enter details for the new prospect\n            </DialogDescription>', '<DialogDescription>{t("amb.leads.enter_details")}</DialogDescription>')
    count += 1
    
    content = content.replace('<Label>Lead Type</Label>', '<Label>{t("amb.leads.lead_type")}</Label>')
    count += 1
    content = content.replace('<SelectItem value="store">Store</SelectItem>', '<SelectItem value="store">{t("amb.leads.store")}</SelectItem>')
    count += 1
    content = content.replace('<SelectItem value="wholesaler">Wholesaler</SelectItem>', '<SelectItem value="wholesaler">{t("amb.leads.wholesaler")}</SelectItem>')
    count += 1
    content = content.replace('<SelectItem value="influencer">Influencer / Street Team</SelectItem>', '<SelectItem value="influencer">{t("amb.leads.influencer")}</SelectItem>')
    count += 1
    content = content.replace('<SelectItem value="ambassador">Ambassador Recruit</SelectItem>', '<SelectItem value="ambassador">{t("amb.leads.ambassador")}</SelectItem>')
    count += 1
    
    content = content.replace('<Label>Business / Contact Name *</Label>', '<Label>{t("amb.leads.business_name")}</Label>')
    count += 1
    content = content.replace('<Label>Contact Name</Label>', '<Label>{t("amb.leads.contact_name")}</Label>')
    count += 1
    content = content.replace('<Label>Phone</Label>', '<Label>{t("amb.leads.phone")}</Label>')
    count += 1
    content = content.replace('<Label>Email</Label>', '<Label>{t("amb.leads.email")}</Label>')
    count += 1
    content = content.replace('<Label>Address</Label>', '<Label>{t("amb.leads.address")}</Label>')
    count += 1
    content = content.replace('<Label>City</Label>', '<Label>{t("amb.leads.city")}</Label>')
    count += 1
    content = content.replace('<Label>State</Label>', '<Label>{t("amb.leads.state")}</Label>')
    count += 1
    content = content.replace('<Label>Zip Code</Label>', '<Label>{t("amb.leads.zipcode")}</Label>')
    count += 1
    content = content.replace('<Label>Notes</Label>', '<Label>{t("amb.leads.notes")}</Label>')
    count += 1
    content = content.replace('placeholder="Any additional notes..."', 'placeholder={t("amb.leads.notes_placeholder")}')
    count += 1
    
    content = content.replace('<Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancel</Button>', '<Button variant="outline" onClick={() => setAddLeadOpen(false)}>{t("amb.routes.cancel")}</Button>')
    count += 1
    
    content = content.replace(
        'Add Lead\n            </Button>',
        '<BilingualLabel tKey="amb.leads.add_lead" en="Add Lead" inline />\n            </Button>'
    )
    count += 1
    
    # Lead Detail Modal
    content = content.replace('<DialogDescription>\n              Lead details and actions\n            </DialogDescription>', '<DialogDescription>{t("amb.leads.details_header")}</DialogDescription>')
    count += 1
    content = content.replace('<p className="text-muted-foreground">Contact</p>', '<p className="text-muted-foreground">{t("amb.leads.contact_header")}</p>')
    count += 1
    content = content.replace('<p className="text-muted-foreground">Phone</p>', '<p className="text-muted-foreground">{t("amb.leads.phone")}</p>')
    count += 1
    content = content.replace('<p className="text-muted-foreground">Email</p>', '<p className="text-muted-foreground">{t("amb.leads.email")}</p>')
    count += 1
    content = content.replace('<p className="text-muted-foreground">Address</p>', '<p className="text-muted-foreground">{t("amb.leads.address")}</p>')
    count += 1
    content = content.replace('<p className="text-sm text-muted-foreground mb-1">Notes</p>', '<p className="text-sm text-muted-foreground mb-1">{t("amb.leads.notes")}</p>')
    count += 1
    
    content = content.replace('<p className="text-sm font-medium">Move to Stage</p>', '<p className="text-sm font-medium">{t("amb.leads.move_to_stage")}</p>')
    count += 1
    
    # Conversion help text
    content = content.replace(
        "{selectedLead.lead_type === 'store' && 'This will create a store record and assign it to you'}",
        "{selectedLead.lead_type === 'store' && t('amb.leads.convert_to_store_desc')}"
    )
    count += 1
    content = content.replace(
        "{selectedLead.lead_type === 'wholesaler' && 'This will create a wholesaler record'}",
        "{selectedLead.lead_type === 'wholesaler' && t('amb.leads.convert_to_wholesaler_desc')}"
    )
    count += 1
    content = content.replace(
        "{selectedLead.lead_type === 'ambassador' && 'This will submit for ambassador onboarding'}",
        "{selectedLead.lead_type === 'ambassador' && t('amb.leads.convert_to_ambassador_desc')}"
    )
    count += 1
    content = content.replace(
        "{selectedLead.lead_type === 'influencer' && 'This will activate the influencer'}",
        "{selectedLead.lead_type === 'influencer' && t('amb.leads.convert_to_influencer_desc')}"
    )
    count += 1
    
    # Delete Button
    content = content.replace('Delete Lead\n                  </Button>', '{t("amb.leads.delete_lead")}\n                  </Button>')
    count += 1
    
    # Read-only notice at bottom
    content = content.replace(
        '<p className="text-sm text-muted-foreground text-center">\n                    You are viewing this lead in read-only mode\n                  </p>',
        '<p className="text-sm text-muted-foreground text-center">{t("amb.leads.read_only_notice")}</p>'
    )
    count += 1
    
    # Delete Confirmation
    content = content.replace('<DialogTitle>Delete Lead</DialogTitle>', '<DialogTitle>{t("amb.leads.delete_confirm_title")}</DialogTitle>')
    count += 1
    content = content.replace(
        'Are you sure you want to delete "{leadToDelete?.name}"? This action cannot be undone.',
        't("amb.leads.delete_confirm", { name: leadToDelete?.name })'
    )
    count += 1
    content = content.replace('<Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeletingLead}>\n              Cancel\n            </Button>', '<Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeletingLead}>{t("amb.routes.cancel")}</Button>')
    count += 1
    content = content.replace('Delete\n            </Button>', '{t("amb.leads.delete_lead")}\n            </Button>')
    count += 1
    
    # helper function text
    content = content.replace("case 'store': return 'Convert to Store & Assign';", "case 'store': return t('amb.leads.convert_store');")
    count += 1
    content = content.replace("case 'wholesaler': return 'Convert to Wholesaler';", "case 'wholesaler': return t('amb.leads.convert_wholesaler');")
    count += 1
    content = content.replace("case 'ambassador': return 'Convert to Ambassador';", "case 'ambassador': return t('amb.leads.convert_ambassador');")
    count += 1
    content = content.replace("case 'influencer': return 'Activate Influencer';", "case 'influencer': return t('amb.leads.activate_influencer');")
    count += 1
    content = content.replace("default: return 'Convert';", "default: return t('amb.leads.convert_default');")
    count += 1
    
    return content, count

def wire_dashboard(content):
    count = 0
    if "import { BilingualLabel }" not in content:
        content = content.replace(
            "import { useTranslation } from '@/hooks/useTranslation';",
            "import { useTranslation } from '@/hooks/useTranslation';\nimport { BilingualLabel } from '@/components/portal/BilingualLabel';"
        )

    # Lead KPI Labels
    content = content.replace("label: 'Store Leads',", "label: t('amb.lead.store_leads'),")
    count += 1
    content = content.replace("label: 'Wholesaler Leads',", "label: t('amb.lead.wholesaler_leads'),")
    count += 1
    content = content.replace("label: 'Influencer / Street Team',", "label: t('amb.lead.influencer_leads'),")
    count += 1
    content = content.replace("label: 'Ambassador Recruits',", "label: t('amb.lead.ambassador_leads'),")
    count += 1

    # My Captured Stores
    content = content.replace('<CardTitle className="flex items-center gap-2 text-base">\n            <Store className="h-4 w-4" />\n            My Stores\n          </CardTitle>', '<CardTitle className="flex items-center gap-2 text-base">\n            <Store className="h-4 w-4" />\n            <BilingualLabel tKey="amb.dashboard.my_stores" en="My Stores" />\n          </CardTitle>')
    count += 1
    content = content.replace('<p className="text-sm text-muted-foreground">\n            Stores you capture will appear here. Tap the Capture New Store button to add your first.\n          </p>', '<p className="text-sm text-muted-foreground">{t("amb.dashboard.my_stores_empty")}</p>')
    count += 1
    content = content.replace('<CardTitle className="flex items-center gap-2 text-base">\n          <Store className="h-4 w-4" />\n          My Stores', '<CardTitle className="flex items-center gap-2 text-base">\n          <Store className="h-4 w-4" />\n          <BilingualLabel tKey="amb.dashboard.my_stores" en="My Stores" />')
    count += 1

    # Scope Banner
    content = content.replace('<p className="text-sm font-medium">Your Portfolio</p>', '<p className="text-sm font-medium"><BilingualLabel tKey="amb.dashboard.your_portfolio" en="Your Portfolio" /></p>')
    count += 1
    content = content.replace(
        'Viewing data for {metrics.totalStores} stores you manage ({metrics.assignedStores} assigned, {metrics.sourcedStores} sourced)',
        't("amb.dashboard.viewing_portfolio", { total: metrics.totalStores, assigned: metrics.assignedStores, sourced: metrics.sourcedStores })'
    )
    count += 1

    # KPI Labels
    content = content.replace('label="Total Stores"', 'label={t("amb.kpi.total_stores")}')
    count += 1
    content = content.replace('label="Total Commission"', 'label={t("amb.kpi.total_commission")}')
    count += 1
    content = content.replace('label="Approved"', 'label={t("amb.kpi.approved")}')
    count += 1
    content = content.replace('label="Total Orders"', 'label={t("amb.kpi.total_orders")}')
    count += 1
    content = content.replace('label="Revenue Generated"', 'label={t("amb.kpi.revenue")}')
    count += 1

    # Recent Commissions
    content = content.replace('<CardTitle className="flex items-center gap-2">\n                  <DollarSign className="h-5 w-5" />\n                  Recent Commissions\n                </CardTitle>', '<CardTitle className="flex items-center gap-2">\n                  <DollarSign className="h-5 w-5" />\n                  <BilingualLabel tKey="amb.dashboard.recent_commissions" en="Recent Commissions" />\n                </CardTitle>')
    count += 1
    content = content.replace('<CardDescription>\n                  Your latest earnings\n                </CardDescription>', '<CardDescription>{t("amb.dashboard.latest_earnings")}</CardDescription>')
    count += 1
    content = content.replace('View All\n                <ArrowRight className="ml-1 h-4 w-4" />', '{t("amb.dashboard.view_all")}\n                <ArrowRight className="ml-1 h-4 w-4" />')
    count += 1
    content = content.replace('<p>No commissions yet</p>', '<p>{t("amb.dashboard.no_commissions")}</p>')
    count += 1
    content = content.replace('<p className="text-sm">Start acquiring stores to earn</p>', '<p className="text-sm">{t("amb.dashboard.start_acquiring")}</p>')
    count += 1

    # Quick Actions
    content = content.replace('<CardTitle>Quick Actions</CardTitle>', '<CardTitle><BilingualLabel tKey="amb.dashboard.quick_actions" en="Quick Actions" /></CardTitle>')
    count += 1
    content = content.replace('<span>View Stores</span>', '<span>{t("amb.quick.view_stores")}</span>')
    count += 1
    content = content.replace('<span>Create Order</span>', '<span>{t("amb.quick.create_order")}</span>')
    count += 1
    content = content.replace('<span>My Purchases</span>', '<span>{t("amb.quick.my_purchases")}</span>')
    count += 1
    content = content.replace('<span>My Profits</span>', '<span>{t("amb.quick.my_profits")}</span>')
    count += 1
    content = content.replace('<span>Commissions</span>', '<span>{t("amb.quick.commissions")}</span>')
    count += 1
    content = content.replace('<span>Plan Route</span>', '<span>{t("amb.quick.plan_route")}</span>')
    count += 1
    content = content.replace('<span>Add Lead</span>', '<span>{t("amb.quick.add_lead")}</span>')
    count += 1

    # Store Capture FAB
    content = content.replace('<span className="hidden sm:inline">Capture New Store</span>', '<span className="hidden sm:inline"><BilingualLabel tKey="amb.dashboard.capture_new_store" en="Capture New Store" inline /></span>')
    count += 1
    content = content.replace('<SheetTitle>Capture New Store</SheetTitle>', '<SheetTitle><BilingualLabel tKey="amb.dashboard.capture_new_store" en="Capture New Store" /></SheetTitle>')
    count += 1
    content = content.replace('<SheetDescription>\n              Found a new shop? Add it here. Owner will review before it goes live.\n            </SheetDescription>', '<SheetDescription>{t("amb.dashboard.capture_new_store_desc")}</SheetDescription>')
    count += 1

    return content, count

files = [
    ('src/pages/ambassador/AmbassadorLeads.tsx', wire_leads),
    ('src/pages/ambassador/AmbassadorDashboard.tsx', wire_dashboard)
]

for file_path, func in files:
    with open(file_path, 'r') as f:
        content = f.read()
    new_content, count = func(content)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print(f"{file_path}: {count} replacements")

