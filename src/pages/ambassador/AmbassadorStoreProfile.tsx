/**
 * Ambassador Store Profile - Rich store profile with orders, notes, activity
 * Only accessible for stores the ambassador is assigned to (RLS enforced)
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Store, Phone, Mail, MapPin, Clock, User, 
  Package, DollarSign, FileText, MessageSquare,
  ArrowLeft, Plus, ExternalLink, Calendar, Edit,
  CheckCircle, AlertTriangle, ClipboardList
} from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { UnifiedTubeIntelligenceCard } from '@/components/store/UnifiedTubeIntelligenceCard';
import { BrandStickersCard } from '@/components/store/BrandStickersCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { useAmbassadorStoreProfile } from '@/hooks/useAmbassadorPortfolio';
import { format, formatDistanceToNow } from 'date-fns';
import { useCall } from '@/components/communication/CallProvider';
import { ClickablePhone } from '@/components/communication/ClickablePhone';

function StoreProfileContent() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { initiateCall } = useCall();
  const [newNote, setNewNote] = useState('');
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);

  const { 
    store, 
    orders, 
    notes, 
    contacts,
    isLoading, 
    isError,
    addNote,
    isAddingNote
  } = useAmbassadorStoreProfile(storeId || null);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote(newNote);
    setNewNote('');
    setIsNoteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Store Not Found</h2>
        <p className="text-muted-foreground mb-4">
          You don't have access to this store or it doesn't exist.
        </p>
        <Button onClick={() => navigate('/ambassador')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Calculate order stats
  const totalOrderValue = orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
  const paidOrders = orders.filter((o: any) => o.payment_status === 'paid');
  const unpaidOrders = orders.filter((o: any) => o.payment_status !== 'paid');

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/ambassador')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* Store Header */}
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{store.store_name}</h1>
                  <p className="text-muted-foreground">{store.owner_name}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{store.address}, {store.city}</span>
                </div>
                {store.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <ClickablePhone 
                      phone={store.phone} 
                      entityType="store" 
                      entityId={store.id}
                      entityName={store.store_name}
                    />
                  </div>
                )}
                {store.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{store.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Since {format(new Date(store.created_at), 'MMM yyyy')}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(`/ambassador/visit/${store.id}`)}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Recon Visit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!store.phone}
                onClick={() => {
                  if (!store.phone) { toast.error('No phone on file'); return; }
                  initiateCall({
                    destinationPhone: store.phone,
                    entityType: 'store',
                    entityId: store.id,
                    entityName: store.store_name,
                  });
                }}
              >
                <Phone className="mr-1 h-4 w-4" />
                Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/ambassador/communications?store=${store.id}`)}
              >
                <MessageSquare className="mr-1 h-4 w-4" />
                Message
              </Button>
              <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Note for {store.store_name}</DialogTitle>
                  </DialogHeader>
                  <Textarea 
                    placeholder="Enter your note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={4}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddNote} disabled={isAddingNote || !newNote.trim()}>
                      {isAddingNote ? 'Saving...' : 'Save Note'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalOrderValue.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{paidOrders.length}</p>
                <p className="text-sm text-muted-foreground">Paid Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unpaidOrders.length}</p>
                <p className="text-sm text-muted-foreground">Unpaid Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* UNIFIED Tube Intelligence - Edit + Intelligence in ONE component */}
      <UnifiedTubeIntelligenceCard storeId={store.id} role="ambassador" />

      {/* Brand Stickers - Canonical 4-sticker system */}
      <BrandStickersCard storeId={store.id} role="ambassador" />

      {/* Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>All orders from this store</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order: any) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Order #{order.id.slice(-6)}</span>
                            <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                              {order.payment_status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">${Number(order.total || 0).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notes & Activity</CardTitle>
                <CardDescription>Communication history and notes</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsNoteDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No notes yet</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setIsNoteDialogOpen(true)}
                    >
                      Add First Note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note: any) => (
                      <div 
                        key={note.id}
                        className="p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(note.note_date || note.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                          {note.note_type && (
                            <Badge variant="outline">{note.note_type}</Badge>
                          )}
                        </div>
                        <div 
                          className="text-sm [&_p]:mb-2 [&_strong]:font-semibold [&_br]:block"
                          dangerouslySetInnerHTML={{ __html: note.note_text }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Store Contacts</CardTitle>
              <CardDescription>People at this store</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No contacts added</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((contact: any) => (
                      <div 
                        key={contact.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">{contact.role || 'Staff'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {contact.phone && (
                            <ClickablePhone 
                              phone={contact.phone}
                              entityType="store"
                              entityName={contact.name}
                              variant="icon"
                            />
                          )}
                          {contact.email && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`mailto:${contact.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AmbassadorStoreProfile() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <AmbassadorLayout 
        title="Store Profile" 
        subtitle="Store details and history"
        portalIcon={<Store className="h-4 w-4 text-primary-foreground" />}
      >
        <StoreProfileContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
