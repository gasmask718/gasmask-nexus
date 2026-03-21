export const TRIGGER_TYPES = [
  { value: 'no_visit_30_days', label: 'No store visit in 30+ days', description: 'Fires when a store has not been visited in 30+ days', icon: 'CalendarX', config_fields: [{ key: 'days_threshold', label: 'Days without visit', type: 'number', default: 30 }] },
  { value: 'interest_signal', label: 'Interest signal detected', description: 'Fires when a contact marks Interested during a checklist visit', icon: 'Zap', config_fields: [{ key: 'product_filter', label: 'Specific product (optional)', type: 'text', default: '' }] },
  { value: 'call_no_answer', label: 'Call not answered', description: 'Fires after an outreach call results in no answer or voicemail', icon: 'PhoneMissed', config_fields: [{ key: 'attempts_before_trigger', label: 'Attempts before firing', type: 'number', default: 1 }] },
  { value: 'call_interested', label: 'Call resulted in interest', description: 'Fires when an outreach call scores as interested', icon: 'PhoneCall', config_fields: [] },
  { value: 'new_lead_discovered', label: 'New lead discovered', description: 'Fires when Lead Discovery Agent adds a new lead', icon: 'UserPlus', config_fields: [{ key: 'min_lead_score', label: 'Minimum lead score', type: 'number', default: 50 }] },
  { value: 'health_score_critical', label: 'Store health score critical', description: 'Fires when a store health score drops below the threshold', icon: 'AlertTriangle', config_fields: [{ key: 'score_threshold', label: 'Score threshold', type: 'number', default: 40 }] },
  { value: 'sms_reply_received', label: 'SMS reply received', description: 'Fires when a contact replies to an outbound SMS', icon: 'MessageSquare', config_fields: [{ key: 'keyword_filter', label: 'Keyword filter (optional)', type: 'text', default: '' }] },
  { value: 'invoice_created', label: 'New invoice / order created', description: 'Fires when a new invoice is created for a store', icon: 'FileText', config_fields: [] },
  { value: 'callback_requested', label: 'Callback requested during call', description: 'Fires when a call transcript detects a callback request', icon: 'PhoneIncoming', config_fields: [{ key: 'max_wait_days', label: 'Max days to wait', type: 'number', default: 3 }] },
  { value: 'manual', label: 'Manual trigger', description: 'Run manually on demand', icon: 'Play', config_fields: [] },
] as const;

export const CONDITION_TYPES = [
  { value: 'language_is', label: 'Language is', operators: ['equals'], values: ['arabic', 'english', 'spanish', 'unknown'] },
  { value: 'lead_score_above', label: 'Lead score above', operators: ['greater_than'], input_type: 'number' },
  { value: 'lead_score_below', label: 'Lead score below', operators: ['less_than'], input_type: 'number' },
  { value: 'store_type_is', label: 'Store type is', operators: ['equals', 'not_equals'], input_type: 'text' },
  { value: 'phone_type_is', label: 'Phone type is', operators: ['equals'], values: ['mobile', 'landline', 'voip', 'unknown'] },
  { value: 'zip_code_in', label: 'ZIP code in list', operators: ['in'], input_type: 'tags' },
  { value: 'city_is', label: 'City is', operators: ['equals', 'not_equals'], input_type: 'text' },
  { value: 'has_prior_calls', label: 'Has prior calls', operators: ['equals'], values: ['true', 'false'] },
  { value: 'last_call_outcome', label: 'Last call outcome', operators: ['equals', 'not_equals'], values: ['interested', 'not_interested', 'no_answer', 'voicemail', 'callback', 'converted'] },
  { value: 'sms_capable', label: 'SMS capable', operators: ['equals'], values: ['true', 'false'] },
  { value: 'day_of_week', label: 'Day of week', operators: ['in'], values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
] as const;

export const ACTION_TYPES = [
  { value: 'send_sms', label: 'Send SMS', icon: 'MessageSquare', color: 'blue', description: 'Send an SMS message via Twilio', config_fields: [
    { key: 'template', label: 'Message template', type: 'textarea', supports_variables: true },
    { key: 'language_aware', label: 'Language-aware template', type: 'boolean', default: true },
    { key: 'delay_minutes', label: 'Delay (minutes)', type: 'number', default: 0 },
  ]},
  { value: 'queue_elevenlabs_call', label: 'Queue ElevenLabs AI Call', icon: 'Bot', color: 'purple', description: 'Add to ElevenLabs AI call queue', config_fields: [
    { key: 'agent_type', label: 'Agent type', type: 'select', options: ['arabic_specialist', 'english_standard', 'spanish_specialist', 'general', 'auto_detect'] },
    { key: 'delay_hours', label: 'Delay (hours)', type: 'number', default: 0 },
    { key: 'script_override', label: 'Custom script opening', type: 'textarea', supports_variables: true },
  ]},
  { value: 'queue_auto_dialer', label: 'Add to Auto Dialer Queue', icon: 'Phone', color: 'green', description: 'Add contact to Auto Dialer queue', config_fields: [
    { key: 'priority', label: 'Priority', type: 'select', options: ['high', 'medium', 'low'], default: 'medium' },
    { key: 'notes', label: 'Notes', type: 'text', supports_variables: true },
  ]},
  { value: 'create_ai_task', label: 'Create AI Task (Floor 9)', icon: 'CheckSquare', color: 'amber', description: 'Create a task in Floor 9', config_fields: [
    { key: 'title', label: 'Task title', type: 'text', supports_variables: true },
    { key: 'details', label: 'Task details', type: 'textarea', supports_variables: true },
    { key: 'priority', label: 'Priority', type: 'select', options: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    { key: 'department', label: 'Department', type: 'select', options: ['sales', 'field_ops', 'operations', 'management'] },
    { key: 'due_days', label: 'Due in (days)', type: 'number', default: 3 },
  ]},
  { value: 'create_ai_alert', label: 'Create AI Alert (Floor 9)', icon: 'Bell', color: 'red', description: 'Create an alert in Floor 9', config_fields: [
    { key: 'message', label: 'Alert message', type: 'text', supports_variables: true },
    { key: 'severity', label: 'Severity', type: 'select', options: ['critical', 'warning', 'info'], default: 'warning' },
    { key: 'alert_type', label: 'Alert type', type: 'text', default: 'playbook_triggered' },
  ]},
  { value: 'schedule_followup', label: 'Schedule Follow-Up', icon: 'Calendar', color: 'teal', description: 'Schedule a callback or follow-up visit', config_fields: [
    { key: 'followup_type', label: 'Type', type: 'select', options: ['call', 'visit', 'sms', 'any'] },
    { key: 'days_from_now', label: 'Days from now', type: 'number', default: 2 },
    { key: 'notes', label: 'Follow-up notes', type: 'text', supports_variables: true },
    { key: 'assign_to', label: 'Assign to', type: 'select', options: ['drivers', 'bikers', 'ambassadors', 'auto'] },
  ]},
  { value: 'wait', label: 'Wait', icon: 'Clock', color: 'gray', description: 'Pause before the next action', config_fields: [
    { key: 'duration_value', label: 'Duration', type: 'number', default: 1 },
    { key: 'duration_unit', label: 'Unit', type: 'select', options: ['minutes', 'hours', 'days'], default: 'hours' },
  ]},
  { value: 'update_lead_status', label: 'Update Lead Status', icon: 'RefreshCw', color: 'gray', description: 'Change the status of the lead', config_fields: [
    { key: 'new_status', label: 'New status', type: 'select', options: ['new', 'queued', 'called', 'interested', 'callback', 'converted', 'not_interested', 'do_not_call'] },
  ]},
] as const;

export const PLAYBOOK_VARIABLES: Record<string, string> = {
  '{{store_name}}': 'Store name',
  '{{contact_name}}': 'Contact person',
  '{{phone}}': 'Phone number',
  '{{city}}': 'City',
  '{{state}}': 'State',
  '{{language}}': 'Detected language',
  '{{lead_score}}': 'Lead score 0-100',
  '{{last_call_date}}': 'Date of last call',
  '{{last_call_outcome}}': 'Last call outcome',
  '{{product_name}}': 'Product name',
  '{{days_since_visit}}': 'Days since last visit',
  '{{health_score}}': 'Store health score',
  '{{today}}': "Today's date",
  '{{greeting_arabic}}': 'Salam alaikum',
  '{{greeting_english}}': 'Good morning/afternoon',
  '{{greeting_spanish}}': 'Buenos días',
};
