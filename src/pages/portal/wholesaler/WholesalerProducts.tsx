import { useState } from "react";
import { Link } from "react-router-dom";
import { useWholesalerProducts, WholesalerProduct } from "@/services/wholesaler/useWholesalerProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package, Plus, Search, MoreVertical, Edit, Trash2,
  AlertTriangle, Eye, Camera, Check, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";

/**
 * "Your price to Dynasty Direct" — the supplier's own sell price, stored as
 * products_all.supplier_cost. This is the ONLY price a wholesaler may set.
 * Dynasty Direct's downstream store/DTC prices are never exposed or editable here.
 */
function SupplierPriceCell({
  product,
  onSave,
}: {
  product: WholesalerProduct;
  onSave: (id: string, value: number) => Promise<void>;
}) {
  const current = Number((product as any).supplier_cost ?? 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(current.toFixed(2)));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const value = parseFloat(draft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setSaving(true);
    try {
      await onSave(product.id, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(current.toFixed(2)); setEditing(true); }}
        className="dd-num text-[13px] px-2 py-1 border border-transparent hover:border-[hsl(var(--dd-line-strong))]"
        style={{ color: current > 0 ? "hsl(var(--dd-gold))" : "hsl(var(--muted-foreground))" }}
        title="Set your price to Dynasty Direct"
      >
        {current > 0 ? `$${current.toFixed(2)}` : "Set price"}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        autoFocus
        type="number"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 w-24 text-right dd-num"
      />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={commit} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)} disabled={saving}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function WholesalerProducts() {
  const { products, isLoading, deleteProduct, updateProduct } = useWholesalerProducts();
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (product: WholesalerProduct) => {
    if (confirm(`Delete "${product.product_name}"?`)) {
      await deleteProduct(product.id);
    }
  };

  const savePrice = async (id: string, supplier_cost: number) => {
    await updateProduct({ id, supplier_cost });
  };

  const th = "px-3 py-2 text-[11px] uppercase font-semibold";
  const thStyle = { color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] leading-tight" style={{ color: "hsl(var(--dd-navy))" }}>
            Your products
          </h2>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span className="dd-num">{products.length}</span> listed with Dynasty Direct
          </p>
        </div>
        {/* PRIMARY add-product action is camera-first. The typed form stays reachable
            from inside the camera screen as a secondary path, never as the default. */}
        <div className="flex gap-2">
          <Button asChild style={{ background: "hsl(var(--dd-gold))", color: "hsl(var(--dd-navy-deep))" }}>
            <Link to="/portal/wholesaler/catalog/onboard"><Camera className="h-4 w-4 mr-2" />Add product</Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
        <Input
          placeholder="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Loading products…</div>
      ) : filteredProducts.length === 0 ? (
        <div className="dd-panel px-4 py-12 text-center">
          <Package className="h-9 w-9 mx-auto mb-3 opacity-40" />
          <h3 className="font-display text-[16px] mb-1" style={{ color: "hsl(var(--dd-navy))" }}>No products found</h3>
          <p className="text-[13px] mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
            {search ? "Try a different search term" : "Start by adding your first product"}
          </p>
          <Button asChild style={{ background: "hsl(var(--dd-gold))", color: "hsl(var(--dd-navy-deep))" }}>
            <Link to="/portal/wholesaler/catalog/onboard"><Camera className="h-4 w-4 mr-2" />Quick Add by Photo</Link>
          </Button>
        </div>
      ) : (
        <div className="dd-panel overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "hsl(var(--dd-line))" }}>
                <th className={`${th} text-left`} style={thStyle}>Product</th>
                <th className={`${th} text-left`} style={thStyle}>Category</th>
                <th className={`${th} text-right`} style={thStyle}>Your price to Dynasty Direct</th>
                <th className={`${th} text-center`} style={thStyle}>Stock</th>
                <th className={`${th} text-center`} style={thStyle}>Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const low = product.inventory_qty !== null && product.inventory_qty < 10;
                return (
                  <tr key={product.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--dd-line))" }}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                          )}
                        </div>
                        <span className="text-[13px] font-medium truncate" style={{ color: "hsl(var(--dd-ink))" }}>
                          {product.product_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {(product as any).category || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <SupplierPriceCell product={product} onSave={savePrice} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 dd-num text-[13px]" style={{ color: low ? "hsl(var(--dd-gold))" : "hsl(var(--dd-ink))" }}>
                        {low && <AlertTriangle className="h-3.5 w-3.5" />}
                        {product.inventory_qty ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-block px-2 py-0.5 text-[11px] uppercase font-semibold"
                        style={
                          product.status === "active"
                            ? { background: "hsl(var(--dd-navy))", color: "#fff", letterSpacing: "0.03em" }
                            : { border: "1px solid hsl(var(--dd-line-strong))", color: "hsl(var(--muted-foreground))", letterSpacing: "0.03em" }
                        }
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-1 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/portal/wholesaler/products/${product.id}`}>
                              <Eye className="h-4 w-4 mr-2" />View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/portal/wholesaler/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(product)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
        This is the price Dynasty Direct pays you. Dynasty Direct sets its own store and
        consumer prices separately — those are not shown or editable here.
      </p>
    </div>
  );
}
