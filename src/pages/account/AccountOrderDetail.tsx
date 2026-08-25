import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/services/marketplace/useCart";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, ArrowLeft, Truck, RefreshCw, MapPin } from "lucide-react";

interface OrderDetail {
  id: string;
  created_at: string | null;
  total: number | null;
  subtotal: number | null;
  shipping_cost: number | null;
  tax_amount: number | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  shipping_address: any;
  billing_address: any;
  notes: string | null;
}

interface OrderItem {
  id: string;
  product_id: string | null;
  qty: number | null;
  price_each: number;
}

interface ProductLite {
  id: string;
  product_name: string;
  images: any;
  primary_image_url: string | null;
  status: string | null;
}

interface Fulfillment {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
}

export default function AccountOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Record<string, ProductLite>>({});
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!user || !orderId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from("marketplace_orders" as any)
        .select("id, created_at, total, subtotal, shipping_cost, tax_amount, payment_status, fulfillment_status, shipping_address, billing_address, notes")
        .eq("id", orderId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (orderError) {
        toast.error(`Failed to load order: ${orderError.message}`);
        setLoading(false);
        return;
      }
      if (!orderData) {
        setOrder(null);
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setOrder(orderData as any);

      const { data: itemData, error: itemsError } = await supabase
        .from("marketplace_order_items" as any)
        .select("id, product_id, qty, price_each")
        .eq("order_id", orderId);
      if (itemsError) {
        toast.error(`Failed to load order items: ${itemsError.message}`);
      } else if (!cancelled) {
        const rows = (itemData || []) as any as OrderItem[];
        setItems(rows);

        const ids = rows.map((r) => r.product_id).filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: productData, error: productError } = await supabase
            .from("products_all" as any)
            .select("id, product_name, images, primary_image_url, status")
            .in("id", ids);
          if (productError) {
            toast.error(`Failed to load product info: ${productError.message}`);
          } else {
            const map: Record<string, ProductLite> = {};
            ((productData || []) as any as ProductLite[]).forEach((p) => (map[p.id] = p));
            setProducts(map);
          }
        }
      }

      const { data: fData, error: fError } = await supabase
        .from("marketplace_fulfillments" as any)
        .select("id, status, carrier, tracking_number")
        .eq("order_id", orderId);
      if (fError) {
        toast.error(`Failed to load shipments: ${fError.message}`);
      } else if (!cancelled) {
        setFulfillments((fData || []) as any as Fulfillment[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, orderId]);

  const handleReorder = async () => {
    setReordering(true);
    const unavailable: string[] = [];
    let added = 0;
    try {
      for (const item of items) {
        if (!item.product_id) continue;
        const product = products[item.product_id];
        if (!product || product.status !== "active") {
          unavailable.push(product?.product_name || item.product_id);
          continue;
        }
        await addToCart({ productId: item.product_id, qty: item.qty || 1 });
        added += 1;
      }
      if (unavailable.length > 0) {
        toast.warning(`Skipped no-longer-available item${unavailable.length > 1 ? "s" : ""}: ${unavailable.join(", ")}`);
      }
      if (added > 0) {
        navigate("/checkout");
      } else {
        toast.error("None of the items in this order are still available.");
      }
    } catch (e: any) {
      toast.error(`Reorder failed: ${e.message}`);
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">Order not found.</p>
          <Button asChild variant="outline">
            <Link to="/account/orders">Back to orders</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shipTo = order.shipping_address || {};
  const billTo = order.billing_address || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/account/orders">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to orders
          </Link>
        </Button>
        <Button onClick={handleReorder} disabled={reordering}>
          {reordering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Reorder
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Order #{order.id.slice(0, 8).toUpperCase()}</CardTitle>
            <span className="text-sm text-muted-foreground">
              {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge>{order.payment_status || "unknown"}</Badge>
            <Badge variant="secondary">{order.fulfillment_status || "pending"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" /> Items
            </h3>
            <div className="space-y-2">
              {items.map((item) => {
                const product = item.product_id ? products[item.product_id] : undefined;
                const image =
                  product?.primary_image_url ||
                  (Array.isArray(product?.images) ? product?.images?.[0] : undefined);
                const unavailable = product && product.status !== "active";
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {image ? (
                        <img src={image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {product?.product_name || "Product no longer listed"}
                        {unavailable && (
                          <Badge variant="outline" className="ml-2 text-[10px]">unavailable</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                    </div>
                    <p className="text-sm font-medium">${(item.price_each * (item.qty || 1)).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Shipping Address
              </h3>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>{shipTo.fullName || shipTo.name}</p>
                <p>{shipTo.street || shipTo.street1}</p>
                <p>{shipTo.city}, {shipTo.state} {shipTo.zipCode || shipTo.zip}</p>
                <p>{shipTo.phone}</p>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Billing Address
              </h3>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>{billTo.fullName || billTo.name}</p>
                <p>{billTo.street || billTo.street1}</p>
                <p>{billTo.city}, {billTo.state} {billTo.zipCode || billTo.zip}</p>
              </div>
            </div>
          </div>

          {fulfillments.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Shipments
                </h3>
                <div className="space-y-2">
                  {fulfillments.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-sm p-2 rounded-md border">
                      <Badge variant="secondary">{f.status}</Badge>
                      {f.carrier && <span className="text-muted-foreground">{f.carrier}</span>}
                      {f.tracking_number ? (
                        <span className="font-mono">{f.tracking_number}</span>
                      ) : (
                        <span className="text-muted-foreground">Tracking pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>${Number(order.shipping_cost || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>${Number(order.tax_amount || 0).toFixed(2)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${Number(order.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
