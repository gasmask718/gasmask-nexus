import { FieldConfig } from "@/components/crud/EntityModal";
import { GRABBA_BRAND_IDS } from "@/config/grabbaSkyscraper";

const brandOptions = [
  { value: 'all', label: 'All Brands' },
  ...GRABBA_BRAND_IDS.map(b => ({ value: b, label: b.charAt(0).toUpperCase() + b.slice(1) }))
];

export const storeFields: FieldConfig[] = [
  { name: 'name', label: 'Store Name', type: 'text', required: true, placeholder: 'Enter store name' },
  { name: 'address', label: 'Address', type: 'text', placeholder: 'Street address' },
  { name: 'neighborhood', label: 'Neighborhood', type: 'text', placeholder: 'e.g., Bronx, Brooklyn' },
  { name: 'phone', label: 'Phone', type: 'phone', placeholder: '(555) 123-4567' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'store@example.com' },
  { name: 'type', label: 'Store Type', type: 'select', options: [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'convenience', label: 'Convenience' },
    { value: 'smoke_shop', label: 'Smoke Shop' },
  ]},
  { name: 'is_active', label: 'Active', type: 'switch', defaultValue: true },
];

export const companyFields: FieldConfig[] = [
  { name: 'name', label: 'Company Name', type: 'text', required: true, placeholder: 'Enter company name' },
  { name: 'type', label: 'Type', type: 'select', required: true, options: [
    { value: 'store', label: 'Store' },
    { value: 'wholesaler', label: 'Wholesaler' },
    { value: 'direct_customer', label: 'Direct Customer' },
  ]},
  { name: 'default_phone', label: 'Phone', type: 'phone', placeholder: '(555) 123-4567' },
  { name: 'default_email', label: 'Email', type: 'email', placeholder: 'company@example.com' },
  { name: 'neighborhood', label: 'Neighborhood', type: 'text', placeholder: 'e.g., Bronx' },
  { name: 'boro', label: 'Borough', type: 'select', options: [
    { value: 'Bronx', label: 'Bronx' },
    { value: 'Brooklyn', label: 'Brooklyn' },
    { value: 'Manhattan', label: 'Manhattan' },
    { value: 'Queens', label: 'Queens' },
    { value: 'Staten Island', label: 'Staten Island' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...' },
];

export const driverFields: FieldConfig[] = [
  { name: 'name', label: 'Driver Name', type: 'text', required: true, placeholder: 'Full name' },
  { name: 'phone', label: 'Phone', type: 'phone', required: true, placeholder: '(555) 123-4567' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'driver@example.com' },
  { name: 'region', label: 'Region', type: 'select', options: [
    { value: 'bronx', label: 'Bronx' },
    { value: 'brooklyn', label: 'Brooklyn' },
    { value: 'manhattan', label: 'Manhattan' },
    { value: 'queens', label: 'Queens' },
    { value: 'staten_island', label: 'Staten Island' },
  ]},
  { name: 'vehicle_type', label: 'Vehicle Type', type: 'select', options: [
    { value: 'car', label: 'Car' },
    { value: 'bike', label: 'Bike' },
    { value: 'van', label: 'Van' },
    { value: 'motorcycle', label: 'Motorcycle' },
  ]},
  { name: 'active', label: 'Active', type: 'switch', defaultValue: true },
];

export const ambassadorFields: FieldConfig[] = [
  { name: 'tracking_code', label: 'Tracking Code', type: 'text', required: true, placeholder: 'e.g., AMB001' },
  { name: 'tier', label: 'Tier', type: 'select', options: [
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
    { value: 'platinum', label: 'Platinum' },
  ]},
  { name: 'is_active', label: 'Active', type: 'switch', defaultValue: true },
];

export const orderFields: FieldConfig[] = [
  { name: 'brand', label: 'Brand', type: 'select', required: true, options: brandOptions.slice(1) },
  { name: 'boxes', label: 'Boxes', type: 'number', required: true, placeholder: '0' },
  { name: 'tubes_total', label: 'Total Tubes', type: 'number', placeholder: 'Auto-calculated' },
  { name: 'total_amount', label: 'Total Amount ($)', type: 'number', placeholder: '0.00' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Order notes...' },
];

export const invoiceFields: FieldConfig[] = [
  { name: 'invoice_number', label: 'Invoice Number', type: 'text', required: true, placeholder: 'INV-001' },
  { name: 'brand', label: 'Brand', type: 'select', required: true, options: brandOptions.slice(1) },
  { name: 'total_amount', label: 'Total Amount ($)', type: 'number', required: true, placeholder: '0.00' },
  { name: 'due_date', label: 'Due Date', type: 'date' },
  { name: 'payment_status', label: 'Payment Status', type: 'select', options: [
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Invoice notes...' },
];

export const inventoryFields: FieldConfig[] = [
  { name: 'brand', label: 'Brand', type: 'select', required: true, options: brandOptions.slice(1) },
  { name: 'current_tubes_left', label: 'Current Tubes', type: 'number', required: true, placeholder: '0' },
  { name: 'boxes_on_hand', label: 'Boxes On Hand', type: 'number', placeholder: '0' },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Inventory notes...' },
];

export const productionBatchFields: FieldConfig[] = [
  { name: 'brand', label: 'Brand', type: 'select', required: true, options: brandOptions.slice(1) },
  { name: 'batch_number', label: 'Batch Number', type: 'text', required: true, placeholder: 'BATCH-001' },
  { name: 'quantity_produced', label: 'Quantity Produced', type: 'number', required: true, placeholder: '0' },
  { name: 'production_date', label: 'Production Date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'planned', label: 'Planned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'quality_check', label: 'Quality Check' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Batch notes...' },
];

export const routeFields: FieldConfig[] = [
  { name: 'route_date', label: 'Route Date', type: 'date', required: true },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'planned', label: 'Planned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]},
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Route notes...' },
];

export const wholesalerFields: FieldConfig[] = [
  { name: 'name', label: 'Wholesaler Name', type: 'text', required: true, placeholder: 'Company name' },
  { name: 'phone', label: 'Phone', type: 'phone', placeholder: '(555) 123-4567' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'contact@wholesaler.com' },
  { name: 'address', label: 'Address', type: 'text', placeholder: 'Business address' },
  { name: 'is_active', label: 'Active', type: 'switch', defaultValue: true },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...' },
];

export const communicationLogFields: FieldConfig[] = [
  { name: 'communication_type', label: 'Type', type: 'select', required: true, options: [
    { value: 'call', label: 'Call' },
    { value: 'sms', label: 'SMS' },
    { value: 'email', label: 'Email' },
    { value: 'visit', label: 'Visit' },
    { value: 'note', label: 'Note' },
  ]},
  { name: 'direction', label: 'Direction', type: 'select', options: [
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
  ]},
  { name: 'subject', label: 'Subject', type: 'text', placeholder: 'Brief subject...' },
  { name: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Communication details...' },
  { name: 'outcome', label: 'Outcome', type: 'select', options: [
    { value: 'successful', label: 'Successful' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'follow_up_needed', label: 'Follow Up Needed' },
    { value: 'not_interested', label: 'Not Interested' },
  ]},
];
