import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign,
  FileText,
  Receipt,
  Package,
  Upload,
  File,
  Download,
  Trash2,
  Plus,
  Edit
} from 'lucide-react';

const CRMCustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'invoice' | 'receipt' | 'file'>('file');
  const [uploading, setUploading] = useState(false);

  // Fetch customer data
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['crm-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch orders
  const { data: orders } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('customer_id', id)
        .order('order_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ['customer-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select('*')
        .eq('customer_id', id)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch receipts
  const { data: receipts } = useQuery({
    queryKey: ['customer-receipts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_receipts')
        .select('*')
        .eq('customer_id', id)
        .order('receipt_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch files
  const { data: files } = useQuery({
    queryKey: ['customer-files', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_files')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Upload file handler
  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const file = formData.get('file') as File;
      
      if (!file) {
        throw new Error('No file selected');
      }

      // Upload to Supabase Storage
      const filePath = `${id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('customer-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('customer-documents')
        .getPublicUrl(filePath);

      // Save metadata to appropriate table
      if (uploadType === 'invoice') {
        const { error } = await supabase
          .from('customer_invoices')
          .insert({
            customer_id: id,
            invoice_number: formData.get('number') as string,
            invoice_date: formData.get('date') as string,
            total_amount: parseFloat(formData.get('amount') as string),
            status: formData.get('status') as string,
            pdf_url: publicUrl,
          });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['customer-invoices', id] });
      } else if (uploadType === 'receipt') {
        const { error } = await supabase
          .from('customer_receipts')
          .insert({
            customer_id: id,
            receipt_number: formData.get('number') as string,
            receipt_date: formData.get('date') as string,
            amount_paid: parseFloat(formData.get('amount') as string),
            payment_method: formData.get('payment_method') as string,
            pdf_url: publicUrl,
          });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['customer-receipts', id] });
      } else {
        const { error } = await supabase
          .from('customer_files')
          .insert({
            customer_id: id,
            file_name: file.name,
            file_type: file.type,
            file_url: publicUrl,
          });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['customer-files', id] });
      }

      toast({
        title: "File Uploaded",
        description: "File uploaded successfully",
      });

      setUploadModalOpen(false);
      e.currentTarget.reset();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Delete file handler
  const deleteFile = useMutation({
    mutationFn: async ({ fileUrl, table, fileId }: { fileUrl: string; table: 'customer_files' | 'customer_invoices' | 'customer_receipts'; fileId: string }) => {
      // Extract file path from URL
      const path = fileUrl.split('/customer-documents/')[1];
      
      // Delete from storage
      if (path) {
        const { error: storageError } = await supabase.storage
          .from('customer-documents')
          .remove([path]);

        if (storageError) throw storageError;
      }

      // Delete from database
      if (table === 'customer_files') {
        const { error: dbError } = await supabase
          .from('customer_files')
          .delete()
          .eq('id', fileId);
        if (dbError) throw dbError;
      } else if (table === 'customer_invoices') {
        const { error: dbError } = await supabase
          .from('customer_invoices')
          .delete()
          .eq('id', fileId);
        if (dbError) throw dbError;
      } else if (table === 'customer_receipts') {
        const { error: dbError } = await supabase
          .from('customer_receipts')
          .delete()
          .eq('id', fileId);
        if (dbError) throw dbError;
      }
    },
    onSuccess: (_, variables) => {
      toast({ title: "File Deleted" });
      if (variables.table === 'customer_files') {
        queryClient.invalidateQueries({ queryKey: ['customer-files', id] });
      } else if (variables.table === 'customer_invoices') {
        queryClient.invalidateQueries({ queryKey: ['customer-invoices', id] });
      } else if (variables.table === 'customer_receipts') {
        queryClient.invalidateQueries({ queryKey: ['customer-receipts', id] });
      }
    },
  });

  if (loadingCustomer) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Customer not found</p>
        <Button onClick={() => navigate('/crm/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const getBusinessTypeBadge = (type: string) => {
    switch (type) {
      case 'store': return <Badge className="bg-blue-500">Store</Badge>;
      case 'wholesaler': return <Badge className="bg-purple-500">Wholesaler</Badge>;
      case 'direct_buyer': return <Badge className="bg-green-500">Direct Buyer</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getRelationshipBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-600">Active</Badge>;
      case 'warm': return <Badge className="bg-yellow-600">Warm</Badge>;
      case 'cold': return <Badge className="bg-orange-600">Cold</Badge>;
      case 'lost': return <Badge variant="destructive">Lost</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-600">Paid</Badge>;
      case 'sent': return <Badge className="bg-blue-600">Sent</Badge>;
      case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Combine all financial events for timeline
  const timelineEvents = [
    ...(orders || []).map(o => ({ type: 'order' as const, date: o.order_date, data: o })),
    ...(invoices || []).map(i => ({ type: 'invoice' as const, date: i.invoice_date, data: i })),
    ...(receipts || []).map(r => ({ type: 'receipt' as const, date: r.receipt_date, data: r })),
    ...(files || []).map(f => ({ type: 'file' as const, date: f.created_at, data: f })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/crm/customers')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{customer.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                {getBusinessTypeBadge(customer.business_type)}
                {getRelationshipBadge(customer.relationship_status)}
              </div>
            </div>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${customer.phone}`} className="text-sm hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${customer.email}`} className="text-sm hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p>{customer.address}</p>
                    {customer.city && customer.state && (
                      <p>{customer.city}, {customer.state} {customer.zip}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${(customer.total_lifetime_value || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {customer.last_order_date 
                ? new Date(customer.last_order_date).toLocaleDateString()
                : 'No orders yet'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineEvents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 border rounded-lg">
                  {event.type === 'order' && <Package className="h-5 w-5 text-blue-500 mt-0.5" />}
                  {event.type === 'invoice' && <FileText className="h-5 w-5 text-purple-500 mt-0.5" />}
                  {event.type === 'receipt' && <Receipt className="h-5 w-5 text-green-500 mt-0.5" />}
                  {event.type === 'file' && <File className="h-5 w-5 text-orange-500 mt-0.5" />}
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold capitalize">{event.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString()}
                      </p>
                    </div>
                    {event.type === 'order' && (
                      <p className="text-sm text-muted-foreground">
                        ${(event.data as any).total.toFixed(2)} • {((event.data as any).items || []).length} items
                      </p>
                    )}
                    {event.type === 'invoice' && (
                      <p className="text-sm text-muted-foreground">
                        {(event.data as any).invoice_number} • ${(event.data as any).total_amount.toFixed(2)}
                      </p>
                    )}
                    {event.type === 'receipt' && (
                      <p className="text-sm text-muted-foreground">
                        {(event.data as any).receipt_number} • ${(event.data as any).amount_paid.toFixed(2)}
                      </p>
                    )}
                    {event.type === 'file' && (
                      <p className="text-sm text-muted-foreground">
                        {(event.data as any).file_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for detailed sections */}
      <Tabs defaultValue="orders">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Order History</CardTitle>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Order
              </Button>
            </CardHeader>
            <CardContent>
              {!orders || orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">{new Date(order.order_date).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {(order.items || []).length} items • {order.payment_method || 'N/A'}
                        </p>
                      </div>
                      <p className="font-bold">${order.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoice History</CardTitle>
              <Button 
                size="sm"
                onClick={() => {
                  setUploadType('invoice');
                  setUploadModalOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Invoice
              </Button>
            </CardHeader>
            <CardContent>
              {!invoices || invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{invoice.invoice_number}</p>
                          {getInvoiceStatusBadge(invoice.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">${invoice.total_amount.toFixed(2)}</p>
                        {invoice.pdf_url && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(invoice.pdf_url, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteFile.mutate({
                                fileUrl: invoice.pdf_url,
                                table: 'customer_invoices',
                                fileId: invoice.id,
                              })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Receipt History</CardTitle>
              <Button 
                size="sm"
                onClick={() => {
                  setUploadType('receipt');
                  setUploadModalOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Receipt
              </Button>
            </CardHeader>
            <CardContent>
              {!receipts || receipts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No receipts yet</p>
              ) : (
                <div className="space-y-3">
                  {receipts.map((receipt: any) => (
                    <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{receipt.receipt_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(receipt.receipt_date).toLocaleDateString()} • {receipt.payment_method}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">${receipt.amount_paid.toFixed(2)}</p>
                        {receipt.pdf_url && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(receipt.pdf_url, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteFile.mutate({
                                fileUrl: receipt.pdf_url,
                                table: 'customer_receipts',
                                fileId: receipt.id,
                              })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>File Manager</CardTitle>
              <Button 
                size="sm"
                onClick={() => {
                  setUploadType('file');
                  setUploadModalOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </CardHeader>
            <CardContent>
              {!files || files.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No files yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(file.file_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteFile.mutate({
                            fileUrl: file.file_url,
                            table: 'customer_files',
                            fileId: file.id,
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upload {uploadType === 'invoice' ? 'Invoice' : uploadType === 'receipt' ? 'Receipt' : 'File'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFileUpload} className="space-y-4">
            {uploadType !== 'file' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="number">
                    {uploadType === 'invoice' ? 'Invoice' : 'Receipt'} Number
                  </Label>
                  <Input id="number" name="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </div>
                {uploadType === 'invoice' && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      name="status"
                      className="w-full p-2 border rounded-md"
                      required
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                )}
                {uploadType === 'receipt' && (
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Input id="payment_method" name="payment_method" />
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="file">File (PDF recommended)</Label>
              <Input 
                id="file" 
                name="file" 
                type="file" 
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                required 
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setUploadModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCustomerDetail;
