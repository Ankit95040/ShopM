"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, PlusCircle, MinusCircle, Search, ChevronRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { addStockAction, removeStockAction, createInventoryItemAction } from "@/server/actions/inventory.actions";
import { StockRemovalReason } from "@prisma/client";
import { useToast } from "@/components/shared/ToastContext";
import type { ItemData } from "@/components/inventory/InventoryDashboard";

export function CategoryDetailView({
  category,
  items: initialItems,
}: {
  category: { id: string; name: string };
  items: ItemData[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<ItemData[]>(initialItems);
  const [activeItem, setActiveItem] = useState<ItemData | null>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isRemoveStockOpen, setIsRemoveStockOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [stockQty, setStockQty] = useState("");
  const [stockSupplier, setStockSupplier] = useState("");
  const [stockPrice, setStockPrice] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [removalReason, setRemovalReason] = useState<StockRemovalReason>(StockRemovalReason.SOLD);
  const [newItemName, setNewItemName] = useState("");
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("Pieces");
  const [newItemThreshold, setNewItemThreshold] = useState("5");
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState("");
  const [newItemSellingPrice, setNewItemSellingPrice] = useState("");
  const [newItemInitialStock, setNewItemInitialStock] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((it) => it.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !stockQty) return;
    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await addStockAction({ itemId: activeItem.id, quantity: qty, supplier: stockSupplier || undefined, purchasePrice: parseFloat(stockPrice) || undefined, notes: stockNotes || undefined });
      if (res.success && res.result) {
        const newStock = Number(res.result.item.currentStock);
        setItems((prev) => prev.map((i) => (i.id === activeItem.id ? { ...i, currentStock: newStock, isLowStock: newStock <= i.minStockThreshold, isOutOfStock: newStock <= 0 } : i)));
        setIsAddStockOpen(false);
        setStockQty(""); setStockSupplier(""); setStockPrice(""); setStockNotes("");
        toast.success("Stock added successfully");
        router.refresh();
      } else toast.error(res.error || "Failed to add stock");
    } catch (err) {
      console.error("Add stock failed:", err);
      toast.error("Failed to add stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !stockQty) return;
    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await removeStockAction({ itemId: activeItem.id, quantity: qty, removalReason, notes: stockNotes || undefined });
      if (res.success && res.result) {
        const newStock = Number(res.result.item.currentStock);
        setItems((prev) => prev.map((i) => (i.id === activeItem.id ? { ...i, currentStock: newStock, isLowStock: newStock <= i.minStockThreshold, isOutOfStock: newStock <= 0 } : i)));
        setIsRemoveStockOpen(false);
        setStockQty(""); setStockNotes("");
        toast.success("Stock removed successfully");
        router.refresh();
      } else toast.error(res.error || "Failed to remove stock");
    } catch (err) {
      console.error("Remove stock failed:", err);
      toast.error("Failed to remove stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await createInventoryItemAction({
        name: newItemName,
        sku: newItemSku || undefined,
        categoryId: category.id,
        unit: newItemUnit,
        minStockThreshold: parseFloat(newItemThreshold) || 5,
        purchasePrice: parseFloat(newItemPurchasePrice) || undefined,
        sellingPrice: parseFloat(newItemSellingPrice) || undefined,
        initialStock: parseFloat(newItemInitialStock) || 0,
      });
      if (res.success && res.item) {
        const created: ItemData = {
          id: res.item.id,
          name: res.item.name,
          sku: res.item.sku,
          unit: res.item.unit,
          currentStock: parseFloat(newItemInitialStock) || 0,
          minStockThreshold: parseFloat(newItemThreshold) || 5,
          purchasePrice: parseFloat(newItemPurchasePrice) || null,
          sellingPrice: parseFloat(newItemSellingPrice) || null,
          categoryName: category.name,
          categoryId: category.id,
          isLowStock: (parseFloat(newItemInitialStock) || 0) <= (parseFloat(newItemThreshold) || 5),
          isOutOfStock: (parseFloat(newItemInitialStock) || 0) <= 0,
        };
        setItems([created, ...items]);
        setIsAddItemOpen(false);
        setNewItemName(""); setNewItemSku(""); setNewItemPurchasePrice(""); setNewItemSellingPrice(""); setNewItemInitialStock("0");
        toast.success("Item added successfully");
        router.refresh();
      } else toast.error(res.error || "Failed to create item");
    } catch (err) {
      console.error("Create item failed:", err);
      toast.error("Failed to create item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/inventory" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight text-slate-900 truncate">{category.name}</h1>
          <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? "item" : "items"} in this category</p>
        </div>
        <button onClick={() => setIsAddItemOpen(true)} className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 min-h-[44px]">
          <Plus className="h-4 w-4 text-sky-400" /> Add Item
        </button>
      </div>

      {/* Mobile Add Item button */}
      <button onClick={() => setIsAddItemOpen(true)} className="sm:hidden w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 min-h-[44px]">
        <Plus className="h-4 w-4 text-sky-400" /> Add Item in {category.name}
      </button>

      {/* Mobile search — below header */}
      <div className="sm:hidden relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="🔍 Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none min-h-[44px]"
        />
      </div>

      {/* Items — Mobile compact rows, Desktop large cards */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">{search ? "No items found" : "No items in this category"}</p>
          <p className="text-xs text-slate-400 mt-1">{search ? `No match for "${search}"` : "Add your first item to get started."}</p>
          {!search && (
            <button onClick={() => setIsAddItemOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white min-h-[44px]">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: compact rows — tap to open item details */}
          <div className="sm:hidden rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={`/inventory/item/${item.id}`}
                className="flex items-center gap-3 px-4 py-3 min-h-[52px] hover:bg-slate-50 active:bg-slate-100 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <span className="text-sm">📦</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">{item.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {formatNumber(item.currentStock, 1)} {item.unit} • {item.isOutOfStock ? "Out of Stock" : item.isLowStock ? "Low Stock" : "In Stock"}
                  </div>
                </div>
                <span className={`hidden sm:inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.isOutOfStock ? "bg-red-100 text-red-800" : item.isLowStock ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                  {item.isOutOfStock ? "Out" : item.isLowStock ? "Low" : "In Stock"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>

          {/* Desktop: large cards (locked) */}
          <div className="hidden sm:block space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-sm text-slate-900 break-words">{item.name}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.unit} • Min {item.minStockThreshold}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold whitespace-nowrap ${item.isOutOfStock ? "bg-red-100 text-red-800" : item.isLowStock ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                    {item.isOutOfStock ? "Out of Stock" : item.isLowStock ? "Low Stock" : "In Stock"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Stock</div>
                    <div className="text-sm font-black text-slate-900">{formatNumber(item.currentStock, 1)}</div>
                  </div>
                  <div className="min-w-0 border-l border-slate-200 pl-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Price</div>
                    <div className="text-xs font-black text-slate-900 whitespace-nowrap">{item.sellingPrice ? formatCurrency(item.sellingPrice) : "-"}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setActiveItem(item); setIsAddStockOpen(true); }} className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                    <PlusCircle className="h-4 w-4" /> + Add
                  </button>
                  <button onClick={() => { setActiveItem(item); setIsRemoveStockOpen(true); }} className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <MinusCircle className="h-4 w-4" /> − Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Item Modal */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">Add Item to {category.name}</h3>
            <form onSubmit={handleCreateItem} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Item Name *</label>
                <input type="text" required placeholder="e.g. Milk 500ml" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base sm:text-xs focus:border-slate-900 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Unit</label>
                  <input type="text" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Min Threshold</label>
                  <input type="number" value={newItemThreshold} onChange={(e) => setNewItemThreshold(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-xs font-bold focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Purchase Price</label>
                  <input type="number" step="0.01" placeholder="0.00" value={newItemPurchasePrice} onChange={(e) => setNewItemPurchasePrice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Selling Price</label>
                  <input type="number" step="0.01" placeholder="0.00" value={newItemSellingPrice} onChange={(e) => setNewItemSellingPrice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-xs font-bold text-emerald-700 focus:border-slate-900 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Initial Stock</label>
                  <input type="number" placeholder="0" value={newItemInitialStock} onChange={(e) => setNewItemInitialStock(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-xs font-bold focus:border-slate-900 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setIsAddItemOpen(false)} className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? "Saving..." : "Add Item"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {isAddStockOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Add Stock: {activeItem.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Current: {activeItem.currentStock} {activeItem.unit}</p>
            <form onSubmit={handleAddStock} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Quantity *</label>
                <input type="number" step="0.001" required placeholder="e.g. 50" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-emerald-600 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Supplier</label>
                <input type="text" placeholder="Supplier" value={stockSupplier} onChange={(e) => setStockSupplier(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base sm:text-xs focus:border-slate-900 focus:outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddStockOpen(false)} className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="w-2/3 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? "Saving..." : "Add Stock"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Stock Modal */}
      {isRemoveStockOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Remove Stock: {activeItem.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Current: {activeItem.currentStock} {activeItem.unit}</p>
            <form onSubmit={handleRemoveStock} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Quantity *</label>
                <input type="number" step="0.001" required placeholder="e.g. 20" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-red-600 focus:border-slate-900 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Reason *</label>
                <select value={removalReason} onChange={(e) => setRemovalReason(e.target.value as StockRemovalReason)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-xs font-bold focus:border-slate-900 focus:outline-none">
                  <option value={StockRemovalReason.SOLD}>Sold</option>
                  <option value={StockRemovalReason.DAMAGED}>Damaged</option>
                  <option value={StockRemovalReason.LOST}>Lost</option>
                  <option value={StockRemovalReason.RETURNED}>Returned</option>
                  <option value={StockRemovalReason.ADJUSTMENT}>Adjustment</option>
                  <option value={StockRemovalReason.OTHER}>Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsRemoveStockOpen(false)} className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="w-2/3 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? "Saving..." : "Remove Stock"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}