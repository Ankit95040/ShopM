"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, MinusCircle, History } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/formatters";
import { addStockAction, removeStockAction } from "@/server/actions/inventory.actions";
import { StockRemovalReason } from "@prisma/client";
import { useToast } from "@/components/shared/ToastContext";

interface Movement {
  id: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  supplier?: string | null;
  purchasePrice?: number | null;
  notes?: string | null;
  movementDate: Date | string;
  createdByName: string;
  removalReason?: string | null;
}

export function ItemDetailView({
  item: initialItem,
  movements: initialMovements,
  categoryName,
}: {
  item: {
    id: string;
    name: string;
    sku?: string | null;
    unit: string;
    currentStock: number;
    minStockThreshold: number;
    purchasePrice?: number | null;
    sellingPrice?: number | null;
    categoryName: string;
    categoryId: string;
    isLowStock: boolean;
    isOutOfStock: boolean;
  };
  movements: Movement[];
  categoryName: string;
}) {
  const toast = useToast();
  const [item, setItem] = useState(initialItem);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [removalReason, setRemovalReason] = useState<StockRemovalReason>(StockRemovalReason.SOLD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) return;
    setIsSubmitting(true);
    const res = await addStockAction({ itemId: item.id, quantity: q, supplier: supplier || undefined, purchasePrice: parseFloat(price) || undefined, notes: notes || undefined });
    setIsSubmitting(false);
    if (res.success && res.result) {
      const newStock = Number(res.result.item.currentStock);
      setItem({ ...item, currentStock: newStock, isLowStock: newStock <= item.minStockThreshold, isOutOfStock: newStock <= 0 });
      const newMov: Movement = {
        id: res.result.movement.id,
        type: "ADD_STOCK",
        quantity: q,
        previousStock: Number(res.result.movement.previousStock),
        newStock,
        supplier: supplier || null,
        purchasePrice: parseFloat(price) || null,
        notes: notes || null,
        movementDate: new Date(),
        createdByName: "You",
      };
      setMovements([newMov, ...movements]);
      setIsAddOpen(false); setQty(""); setSupplier(""); setPrice(""); setNotes(""); toast.success("Stock added");
    } else toast.error(res.error || "Failed to add");
  };

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) return;
    setIsSubmitting(true);
    const res = await removeStockAction({ itemId: item.id, quantity: q, removalReason, notes: notes || undefined });
    setIsSubmitting(false);
    if (res.success && res.result) {
      const newStock = Number(res.result.item.currentStock);
      setItem({ ...item, currentStock: newStock, isLowStock: newStock <= item.minStockThreshold, isOutOfStock: newStock <= 0 });
      const newMov: Movement = {
        id: res.result.movement.id,
        type: "REMOVE_STOCK",
        quantity: q,
        previousStock: Number(res.result.movement.previousStock),
        newStock,
        supplier: null,
        purchasePrice: null,
        notes: notes || null,
        movementDate: new Date(),
        createdByName: "You",
        removalReason,
      };
      setMovements([newMov, ...movements]);
      setIsRemoveOpen(false); setQty(""); setNotes(""); toast.success("Stock removed");
    } else toast.error(res.error || "Failed to remove");
  };

  const isLowStock = item.isLowStock;
  const isOutOfStock = item.isOutOfStock;

  return (
    <div className="space-y-4 min-w-0">
      {/* Header — single source of truth (mobile + desktop) */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href={`/inventory/category/${item.categoryId}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight text-slate-900 truncate">{item.name}</h1>
          <p className="text-xs text-slate-500 truncate">{categoryName} • {item.unit}</p>
          <div className={`sm:hidden mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isOutOfStock ? "bg-red-50 text-red-700" : isLowStock ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            <span className={`h-2 w-2 rounded-full ${isOutOfStock ? "bg-red-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
          </div>
        </div>
      </div>

      {/* Desktop card — hidden on mobile */}
      <div className="hidden sm:flex rounded-2xl border border-slate-200 bg-white p-4 shadow-xs items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
          <span className="text-2xl">📦</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-black text-slate-900 truncate">{item.name}</div>
          <div className="text-xs text-slate-500 truncate">{categoryName}</div>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${isOutOfStock ? "bg-red-100 text-red-800 border border-red-200" : isLowStock ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
            {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
          </span>
        </div>
      </div>

      {/* Stock summary — mobile borderless 2-col (unit merged), desktop cards locked */}
      <div className="sm:hidden grid grid-cols-2 gap-6 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Current Stock</div>
          <div className={`text-xl font-black mt-1 truncate ${isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-slate-900"}`}>{formatNumber(item.currentStock, 1)} {item.unit}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Low Stock Alert</div>
          <div className="text-xl font-black text-slate-600 mt-1 truncate">{String(item.minStockThreshold)} units</div>
        </div>
      </div>
      <div className="hidden sm:grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Current Stock</div>
          <div className="text-lg font-black text-slate-900">{formatNumber(item.currentStock, 1)}</div>
          <div className="text-[10px] text-slate-400">{item.unit}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Unit</div>
          <div className="text-sm font-black text-slate-900 mt-1">{item.unit}</div>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Low Stock Alert</div>
          <div className="text-lg font-black text-amber-900">{item.minStockThreshold}</div>
          <div className="text-[10px] text-amber-700">units</div>
        </div>
      </div>

      {/* Add / Remove — side by side, not in card */}
      <div className="flex gap-3">
        <button onClick={() => setIsAddOpen(true)} className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-sky-100 sm:bg-white sm:border sm:border-sky-200 px-4 py-3 text-sm font-bold text-sky-700 hover:bg-sky-100 sm:hover:bg-sky-50 active:bg-sky-200">
          <Plus className="h-4 w-4" /> Add Stock
        </button>
        <button onClick={() => setIsRemoveOpen(true)} className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-50 sm:bg-white sm:border sm:border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 sm:hover:bg-red-50 active:bg-red-200 sm:active:bg-red-100">
          <MinusCircle className="h-4 w-4" /> Remove Stock
        </button>
      </div>

      {/* Stock History — mobile borderless list, desktop card locked */}
      <div className="sm:hidden pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Stock History</h3>
          <span className="text-xs text-slate-400">{movements.length} records</span>
        </div>
        {movements.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No stock history yet</p>
        ) : (
          <>
            <div className={historyExpanded ? "divide-y divide-slate-100/70 mt-2 max-h-[380px] overflow-y-auto" : "divide-y divide-slate-100/70 mt-2"}>
              {(historyExpanded ? movements : movements.slice(0, 3)).map((m) => {
                const isAdd = m.type === "ADD_STOCK";
                return (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isAdd ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      <span className="text-sm font-bold">{isAdd ? "↗" : "↘"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-black truncate ${isAdd ? "text-emerald-600" : "text-red-600"}`}>{isAdd ? `+${m.quantity} ${item.unit}` : `−${m.quantity} ${item.unit}`}</div>
                      <div className="text-[11px] text-slate-500 truncate">{m.createdByName} • {formatDate(m.movementDate, "dd MMM • hh:mm a")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {movements.length > 3 && (
              <button type="button" onClick={() => setHistoryExpanded(!historyExpanded)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700 bg-transparent border-0 p-0 min-h-[36px]">
                {historyExpanded ? "Show less ↑" : `View all ${movements.length} movements ↓`}
              </button>
            )}
          </>
        )}
      </div>
      <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><History className="h-4 w-4" /> Stock History</h3>
          <span className="text-xs text-slate-400">{movements.length} records</span>
        </div>
        {movements.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No stock history yet</p>
        ) : (
          <>
            <div className={historyExpanded ? "divide-y divide-slate-100 max-h-[320px] overflow-y-auto -mx-1 px-1" : "divide-y divide-slate-100"}>
              {(historyExpanded ? movements : movements.slice(0, 3)).map((m) => {
                const isAdd = m.type === "ADD_STOCK";
                return (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isAdd ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      <span className="text-sm font-bold">{isAdd ? "↗" : "↘"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-black ${isAdd ? "text-emerald-600" : "text-red-600"}`}>{isAdd ? `+${m.quantity} units` : `−${m.quantity} units`}</div>
                      <div className="text-[11px] text-slate-500 truncate">{m.createdByName} • {formatDate(m.movementDate, "dd MMM • hh:mm a")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {movements.length > 3 && (
              <button type="button" onClick={() => setHistoryExpanded(!historyExpanded)} className="w-full mt-3 inline-flex items-center justify-center gap-1 py-2.5 text-sm font-bold text-sky-600 hover:text-sky-700 bg-transparent border-0 min-h-[36px]">
                {historyExpanded ? "Show less ↑" : "View all transactions ↓"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Add Stock Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Add Stock</h3>
              <button onClick={() => setIsAddOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100">✕</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Add new stock for {item.name}</p>
            <form onSubmit={handleAdd} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Quantity *</label>
                <div className="mt-1 flex rounded-xl border border-slate-300 overflow-hidden focus-within:border-slate-900">
                  <input type="number" step="0.001" required placeholder="10" value={qty} onChange={(e) => setQty(e.target.value)} className="flex-1 px-3.5 py-3 text-base font-bold focus:outline-none min-h-[44px]" />
                  <span className="flex items-center bg-slate-100 px-3 text-xs font-bold text-slate-600 border-l border-slate-300">{item.unit}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Notes (optional)</label>
                <textarea placeholder="E.g. Purchased from supplier, invoice no., etc." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm focus:border-slate-900 focus:outline-none min-h-[44px]" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50 min-h-[44px]">Add Stock</button>
              <button type="button" onClick={() => setIsAddOpen(false)} className="w-full rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 min-h-[44px]">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Remove Stock Modal */}
      {isRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Remove Stock</h3>
              <button onClick={() => setIsRemoveOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100">✕</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Remove stock for {item.name}</p>
            <form onSubmit={handleRemove} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Quantity *</label>
                <div className="mt-1 flex rounded-xl border border-slate-300 overflow-hidden focus-within:border-slate-900">
                  <input type="number" step="0.001" required placeholder="5" value={qty} onChange={(e) => setQty(e.target.value)} className="flex-1 px-3.5 py-3 text-base font-bold focus:outline-none min-h-[44px]" />
                  <span className="flex items-center bg-slate-100 px-3 text-xs font-bold text-slate-600 border-l border-slate-300">{item.unit}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Reason</label>
                <select value={removalReason} onChange={(e) => setRemovalReason(e.target.value as StockRemovalReason)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm font-bold focus:border-slate-900 focus:outline-none min-h-[44px]">
                  <option value={StockRemovalReason.SOLD}>Sold/Used</option>
                  <option value={StockRemovalReason.DAMAGED}>Damaged</option>
                  <option value={StockRemovalReason.LOST}>Lost</option>
                  <option value={StockRemovalReason.RETURNED}>Returned</option>
                  <option value={StockRemovalReason.ADJUSTMENT}>Adjustment</option>
                  <option value={StockRemovalReason.OTHER}>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Notes</label>
                <textarea placeholder="Reason for removal" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm focus:border-slate-900 focus:outline-none min-h-[44px]" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 min-h-[44px]">Remove Stock</button>
              <button type="button" onClick={() => setIsRemoveOpen(false)} className="w-full rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 min-h-[44px]">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
