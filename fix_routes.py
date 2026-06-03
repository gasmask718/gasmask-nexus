import re

with open('src/pages/ambassador/AmbassadorRoutes.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace(
    "import { useTranslation } from '@/hooks/useTranslation';",
    "import { useTranslation } from '@/hooks/useTranslation';\nimport { BilingualLabel } from '@/components/portal/BilingualLabel';"
)

# Toasts
content = content.replace("toast.error('Please enter a route name');", "toast.error(t('amb.routes.toast_name_required'));")
content = content.replace("toast.error('Please select a store');", "toast.error(t('amb.routes.toast_store_required'));")

# Calendar Strip
content = content.replace('<h3 className="font-semibold">Week of {format(weekStart, \'MMMM d, yyyy\')}</h3>', '<h3 className="font-semibold"><BilingualLabel tKey="amb.routes.week_of" en="Week of" inline /> {format(weekStart, \'MMMM d, yyyy\')}</h3>')
content = content.replace('onClick={() => setSelectedDate(addDays(selectedDate, -7))}\n                >\n                  Previous', 'onClick={() => setSelectedDate(addDays(selectedDate, -7))}\n                >\n                  {t(\'amb.routes.previous\')}')
content = content.replace('onClick={() => setSelectedDate(new Date())}\n                >\n                  Today', 'onClick={() => setSelectedDate(new Date())}\n                >\n                  {t(\'amb.routes.today\')}')
content = content.replace('onClick={() => setSelectedDate(addDays(selectedDate, 7))}\n                >\n                  Next', 'onClick={() => setSelectedDate(addDays(selectedDate, 7))}\n                >\n                  {t(\'amb.routes.next\')}')

# Today's Route Summary
content = content.replace(
    "{todaysRoute?.title || `Route for ${format(selectedDate, 'EEEE, MMM d')}`}",
    "{todaysRoute?.title || `${t('amb.routes.route_for')} ${format(selectedDate, 'EEEE, MMM d')}`}"
)
content = content.replace(
    "{todaysRoute \n                    ? `${completedStops} of ${totalStops} stops completed`\n                    : 'No route planned for this day'\n                  }",
    "{todaysRoute \n                    ? `${completedStops} ${t('amb.routes.stops_of')} ${totalStops} ${t('amb.routes.completed_suffix')}`\n                    : t('amb.routes.no_route_today')\n                  }"
)
content = content.replace(
    '<Plus className="h-4 w-4 mr-2" />\n                  Add Stop',
    '<Plus className="h-4 w-4 mr-2" />\n                  <BilingualLabel tKey="amb.routes.add_stop" en="Add Stop" inline />'
)
content = content.replace('onClick={() => openCompleteStop(stop)}>\n                              Complete', 'onClick={() => openCompleteStop(stop)}>\n                              {t(\'amb.routes.complete\')}')
content = content.replace('onClick={() => navigateToStore(stop.store_id)}>\n                            View Details', 'onClick={() => navigateToStore(stop.store_id)}>\n                            {t(\'amb.routes.view_details\')}')

# Empty states
content = content.replace('<h3 className="font-medium mb-2">No Stops Yet</h3>', '<h3 className="font-medium mb-2"><BilingualLabel tKey="amb.routes.no_stops_yet" en="No Stops Yet" /></h3>')
content = content.replace('<p className="text-sm text-muted-foreground mb-4">\n                    Add stores to your route\n                  </p>', '<p className="text-sm text-muted-foreground mb-4">\n                    <BilingualLabel tKey="amb.routes.add_stores_to_route" en="Add stores to your route" />\n                  </p>')
content = content.replace('<h3 className="font-medium mb-2">No Route Planned</h3>', '<h3 className="font-medium mb-2"><BilingualLabel tKey="amb.routes.no_route_planned" en="No Route Planned" /></h3>')
content = content.replace('<p className="text-sm text-muted-foreground mb-4">\n                    Create a route for this day to optimize your store visits\n                  </p>', '<p className="text-sm text-muted-foreground mb-4">\n                    <BilingualLabel tKey="amb.routes.create_route_help" en="Create a route for this day to optimize your store visits" />\n                  </p>')
content = content.replace('<Plus className="h-4 w-4 mr-2" />\n                    Create Route', '<Plus className="h-4 w-4 mr-2" />\n                    <BilingualLabel tKey="amb.routes.create_route" en="Create Route" inline />')

# Stats
content = content.replace('<p className="text-sm text-muted-foreground">Stops Completed</p>', '<p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.routes.stops_completed" en="Stops Completed" /></p>')
content = content.replace('<CardTitle className="text-sm">Available Stores</CardTitle>', '<CardTitle className="text-sm"><BilingualLabel tKey="amb.routes.available_stores" en="Available Stores" /></CardTitle>')
content = content.replace('No stores assigned yet', '{t(\'amb.routes.no_stores_assigned\')}')

# History
content = content.replace('<CardTitle className="text-lg">Recent Routes</CardTitle>', '<CardTitle className="text-lg"><BilingualLabel tKey="amb.routes.recent_routes" en="Recent Routes" /></CardTitle>')
content = content.replace('<CardDescription>Your past routes and visit history</CardDescription>', '<CardDescription><BilingualLabel tKey="amb.routes.past_routes" en="Your past routes and visit history" /></CardDescription>')
content = content.replace('{route.completed_stops}/{route.stops_count} completed', '{route.completed_stops}/{route.stops_count} {t(\'amb.routes.stops_completed_count\')}')
content = content.replace('<p>No routes yet</p>', '<p><BilingualLabel tKey="amb.routes.no_routes" en="No routes yet" /></p>')
content = content.replace('<p className="text-sm">Create your first route to get started</p>', '<p className="text-sm"><BilingualLabel tKey="amb.routes.first_route" en="Create your first route to get started" /></p>')

# Modals
content = content.replace('<DialogTitle>Create New Route</DialogTitle>', '<DialogTitle><BilingualLabel tKey="amb.routes.create_new_route" en="Create New Route" /></DialogTitle>')
content = content.replace('<DialogDescription>\n              Plan your store visits for the day\n            </DialogDescription>', '<DialogDescription>\n              <BilingualLabel tKey="amb.routes.plan_visits" en="Plan your store visits for the day" />\n            </DialogDescription>')
content = content.replace('<Label>Route Name</Label>', '<Label><BilingualLabel tKey="amb.routes.route_name" en="Route Name" /></Label>')
content = content.replace('placeholder="e.g. Manhattan Route, Bronx Stores"', 'placeholder={t(\'amb.routes.route_name\')}')
content = content.replace('<Label>Date</Label>', '<Label><BilingualLabel tKey="amb.routes.date" en="Date" /></Label>')
content = content.replace('onClick={() => setCreateRouteOpen(false)}>Cancel</Button>', 'onClick={() => setCreateRouteOpen(false)}>{t(\'amb.routes.cancel\')}</Button>')
content = content.replace('Create Route\n            </Button>', '{t(\'amb.routes.create_route\')}\n            </Button>')

content = content.replace('<DialogTitle>Add Stop to Route</DialogTitle>', '<DialogTitle><BilingualLabel tKey="amb.routes.add_stop_to_route" en="Add Stop to Route" /></DialogTitle>')
content = content.replace('<DialogDescription>\n              Select a store to add to your route\n            </DialogDescription>', '<DialogDescription>\n              <BilingualLabel tKey="amb.routes.select_store_help" en="Select a store to add to your route" />\n            </DialogDescription>')
content = content.replace('<Label>Select Store</Label>', '<Label><BilingualLabel tKey="amb.routes.select_store" en="Select Store" /></Label>')
content = content.replace('<SelectValue placeholder="Choose a store..." />', '<SelectValue placeholder={t(\'amb.routes.choose_store\')} />')
content = content.replace('onClick={() => setAddStopOpen(false)}>Cancel</Button>', 'onClick={() => setAddStopOpen(false)}>{t(\'amb.routes.cancel\')}</Button>')
content = content.replace('Add Stop\n            </Button>', '{t(\'amb.routes.add_stop\')}\n            </Button>')

content = content.replace('<DialogTitle>Complete Stop</DialogTitle>', '<DialogTitle><BilingualLabel tKey="amb.routes.complete_stop" en="Complete Stop" /></DialogTitle>')
content = content.replace('<DialogDescription>\n              Record the outcome of your visit\n            </DialogDescription>', '<DialogDescription>\n              <BilingualLabel tKey="amb.routes.record_outcome" en="Record the outcome of your visit" />\n            </DialogDescription>')
content = content.replace('<Label>Outcome Notes</Label>', '<Label><BilingualLabel tKey="amb.routes.outcome_notes" en="Outcome Notes" /></Label>')
content = content.replace('placeholder="What happened during the visit?"', 'placeholder={t(\'amb.routes.what_happened\')}')
content = content.replace('onClick={() => setCompleteStopOpen(false)}>Cancel</Button>', 'onClick={() => setCompleteStopOpen(false)}>{t(\'amb.routes.cancel\')}</Button>')
content = content.replace('Skip\n            </Button>', '{t(\'amb.routes.skip\')}\n            </Button>')
content = content.replace('Complete\n            </Button>', '{t(\'amb.routes.complete\')}\n            </Button>')

with open('src/pages/ambassador/AmbassadorRoutes.tsx', 'w') as f:
    f.write(content)
