import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/services/marketplace/useCart";
import { useCheckout, ShippingAddress } from "@/services/marketplace/useCheckout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, ArrowLeft, CreditCard, Truck, Store, 
  Package, Loader2, CheckCircle, MapPin 
} from "lucide-react";

export default function Checkout() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { items, totals, clearCart } = useCart();
  const { createOrder, isCreatingOrder } = useCheckout();

  const [step, setStep] = useState<'shipping' | 'payment' | 'review'>('shipping');
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    phone: '',
  });

  const [deliveryType, setDeliveryType] = useState<'ship' | 'pickup' | 'delivery'>('ship');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'net_terms'>('card');
  const [notes, setNotes] = useState('');

  const isStoreUser = userRole === 'store' || userRole === 'store_owner';

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
      setOrderId(result.orderId);
      setOrderComplete(true);
    } catch (error) {
      console.error('Order failed:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sign in to checkout</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0 && !orderComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Your cart is empty</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/shop">Browse Products</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderComplete && orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CheckCircle className="h-20 w-20 mx-auto text-green-500 mb-4" />
            <CardTitle className="text-2xl">Order Placed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Thank you for your order. Your order number is:
            </p>
            <Badge variant="outline" className="text-lg px-4 py-2">
              #{orderId.slice(0, 8).toUpperCase()}
            </Badge>
            <p className="text-sm text-muted-foreground">
              You will receive a confirmation email shortly.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to="/portal/customer">View Orders</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/shop">Continue Shopping</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/cart" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Cart
          </Link>
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            Checkout
          </span>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['shipping', 'payment', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['shipping', 'payment', 'review'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-12 h-0.5 bg-muted mx-2" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {/* Shipping Step */}
            {step === 'shipping' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label>Full Name</Label>
                      <Input
                        value={shippingAddress.fullName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Street Address</Label>
                      <Input
                        value={shippingAddress.street}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, street: e.target.value }))}
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Miami"
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="FL"
                      />
                    </div>
                    <div>
                      <Label>ZIP Code</Label>
                      <Input
                        value={shippingAddress.zipCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                        placeholder="33101"
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={shippingAddress.phone}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="mb-3 block">Delivery Method</Label>
                    <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as any)}>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="ship" id="ship" />
                        <Label htmlFor="ship" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Truck className="h-4 w-4" />
                          Standard Shipping (3-5 days)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <Label htmlFor="delivery" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Package className="h-4 w-4" />
                          Local Delivery (Same day)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Store className="h-4 w-4" />
                          Pickup from Warehouse
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => setStep('payment')}>
                    Continue to Payment
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                    <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                        <CreditCard className="h-4 w-4" />
                        Credit/Debit Card
                      </Label>
                    </div>
                    {isStoreUser && (
                      <>
                        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                          <RadioGroupItem value="cash" id="cash" />
                          <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                            💵 Cash on Delivery
                            <Badge variant="secondary" className="ml-auto">Store Only</Badge>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                          <RadioGroupItem value="net_terms" id="net_terms" />
                          <Label htmlFor="net_terms" className="flex items-center gap-2 cursor-pointer flex-1">
                            📋 Net 30 Terms
                            <Badge variant="secondary" className="ml-auto">Store Only</Badge>
                          </Label>
                        </div>
                      </>
                    )}
                  </RadioGroup>

                  {paymentMethod === 'card' && (
                    <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                      <p>Card payment will be processed via Stripe after order review.</p>
                    </div>
                  )}

                  <div>
                    <Label>Order Notes (Optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special instructions for your order..."
                      className="mt-2"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('shipping')}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setStep('review')}>
                    Review Order
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Review Step */}
            {step === 'review' && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Your Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Shipping Info */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Shipping To
                    </h4>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p>{shippingAddress.fullName}</p>
                      <p>{shippingAddress.street}</p>
                      <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                      <p>{shippingAddress.phone}</p>
                    </div>
                  </div>

                  {/* Delivery & Payment */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Delivery Method</h4>
                      <Badge variant="outline">
                        {deliveryType === 'ship' ? 'Standard Shipping' :
                         deliveryType === 'delivery' ? 'Local Delivery' : 'Pickup'}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Payment</h4>
                      <Badge variant="outline">
                        {paymentMethod === 'card' ? 'Credit Card' :
                         paymentMethod === 'cash' ? 'Cash on Delivery' : 'Net 30'}
                      </Badge>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="font-medium mb-2">Items ({items.length})</h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm p-2 bg-muted rounded">
                          <span>{item.product?.product_name} × {item.qty}</span>
                          <span>${((item.price_locked || 0) * item.qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('payment')}>
                    Back
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={handlePlaceOrder}
                    disabled={isCreatingOrder}
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Place Order - $${totals.total.toFixed(2)}`
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      {item.product?.images?.[0] ? (
                        <img src={item.product.images[0]} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product?.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                    </div>
                    <p className="text-sm font-medium">
                      ${((item.price_locked || 0) * item.qty).toFixed(2)}
                    </p>
                  </div>
                ))}
                {items.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{items.length - 3} more items
                  </p>
                )}

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>${totals.shipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${totals.tax.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
