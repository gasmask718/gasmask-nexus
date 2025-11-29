import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/services/marketplace/useCart";
import { useCheckout, ShippingAddress } from "@/services/marketplace/useCheckout";
import { useStoreProfile } from "@/services/store/useStoreProfile";
import { CreditCard, Truck, Store, Banknote, ArrowLeft, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function StoreCheckout() {
  const navigate = useNavigate();
  const { items, totals, clearCart } = useCart();
  const { createOrder, isCreatingOrder } = useCheckout();
  const { profile } = useStoreProfile();

  const [step, setStep] = useState(1);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: profile?.contact_name || '',
    street: profile?.address_line1 || '',
    city: profile?.city || '',
    state: profile?.state || '',
    zipCode: profile?.postal_code || '',
    country: profile?.country || 'USA',
    phone: profile?.phone || '',
  });
  const [deliveryType, setDeliveryType] = useState<'ship' | 'pickup' | 'delivery'>('ship');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'net_terms'>('card');
  const [notes, setNotes] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handlePlaceOrder = async () => {
    try {
      const result = await createOrder({
        items,
        totals,
        shippingAddress,
        deliveryType,
        paymentMethod,
        notes,
      });
      await clearCart();
      navigate(`/portal/store/orders/${result.orderId}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Link to="/portal/store/products">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/portal/store/cart">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="text-muted-foreground">Complete your B2B order</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Full Name / Business Name</Label>
                      <Input
                        value={shippingAddress.fullName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Street Address</Label>
                      <Input
                        value={shippingAddress.street}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, street: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>ZIP Code</Label>
                      <Input
                        value={shippingAddress.zipCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={shippingAddress.phone}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setStep(2)}>
                    Continue to Delivery & Payment
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as any)}>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="ship" id="ship" />
                        <Label htmlFor="ship" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Truck className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Ship to Address</p>
                            <p className="text-sm text-muted-foreground">Standard shipping</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <Label htmlFor="pickup" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Store className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Pickup from Wholesaler</p>
                            <p className="text-sm text-muted-foreground">Pick up at wholesaler location</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <Label htmlFor="delivery" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Truck className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Local Delivery</p>
                            <p className="text-sm text-muted-foreground">Driver delivery (if available)</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Credit/Debit Card</p>
                            <p className="text-sm text-muted-foreground">Pay now with card</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label htmlFor="cash" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Banknote className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Cash on Delivery</p>
                            <p className="text-sm text-muted-foreground">Pay when you receive</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="net_terms" id="net_terms" />
                        <Label htmlFor="net_terms" className="flex items-center gap-3 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Net 30 Terms</p>
                            <p className="text-sm text-muted-foreground">Invoice due in 30 days</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(3)}>Review Order</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-2">Shipping To</h4>
                    <p className="text-muted-foreground">
                      {shippingAddress.fullName}<br />
                      {shippingAddress.street}<br />
                      {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Delivery</h4>
                    <p className="text-muted-foreground capitalize">{deliveryType}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Payment</h4>
                    <p className="text-muted-foreground capitalize">{paymentMethod.replace('_', ' ')}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Order Notes</h4>
                    <Textarea
                      placeholder="Add any special instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                    <Button 
                      className="flex-1" 
                      onClick={handlePlaceOrder}
                      disabled={isCreatingOrder}
                    >
                      {isCreatingOrder ? 'Placing Order...' : 'Place Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate flex-1">
                        {item.product?.product_name} x{item.qty}
                      </span>
                      <span>{formatCurrency((item.price_locked || 0) * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{formatCurrency(totals.shipping)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
