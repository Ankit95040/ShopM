"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Search,
  History,
  FolderPlus,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  createCategoryAction,
  createInventoryItemAction,
  addStockAction,
  removeStockAction,
} from "@/server/actions/inventory.actions";
import { StockRemovalReason } from "@prisma/client";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/shared/ToastContext";

export interface ItemData {
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
}

export function InventoryDashboard({
  initialItems,
  initialCategories,
}: {
  initialItems: ItemData[];
  initialCategories: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isRemoveStockOpen, setIsRemoveStockOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ItemData | null>(null);

  // Form states
  const [newCatName, setNewCatName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemCatId, setNewItemCatId] = useState(categories[0]?.id || "");
  const [newItemUnit, setNewItemUnit] = useState("Pieces");
  const [newItemThreshold, setNewItemThreshold] = useState("5");
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState("");
  const [newItemSellingPrice, setNewItemSellingPrice] = useState("");
  const [newItemInitialStock, setNewItemInitialStock] = useState("0");

  // Stock update modal states
  const [stockQty, setStockQty] = useState("");
  const [stockSupplier, setStockSupplier] = useState("");
  const [stockPrice, setStockPrice] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [removalReason, setRemovalReason] = useState<StockRemovalReason>(StockRemovalReason.SOLD);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtering
  const filtered = items.filter((item) => {
    const matchesCat =
      selectedCategory === "ALL" || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchesLow = !showLowStockOnly || item.isLowStock;
    return matchesCat && matchesSearch && matchesLow;
  });

  const lowStockCount = items.filter((i) => i.isLowStock).length;
  const outOfStockCount = items.filter((i) => i.isOutOfStock).length;

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    const res = await createCategoryAction(newCatName);
    setIsSubmitting(false);

    if (res.success && res.category) {
      setCategories([...categories, { id: res.category.id, name: res.category.name }]);
      setIsAddCategoryOpen(false);
      setNewCatName("");
      toast.success("Category added successfully");
    } else {
      toast.error(res.error || "Failed to create category");
    }
  };

  // Create Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCatId) return;

    setIsSubmitting(true);

    const initStock = parseFloat(newItemInitialStock) || 0;
    const thresh = parseFloat(newItemThreshold) || 5;

    const res = await createInventoryItemAction({
      name: newItemName,
      sku: newItemSku || undefined,
      categoryId: newItemCatId,
      unit: newItemUnit,
      minStockThreshold: thresh,
      purchasePrice: parseFloat(newItemPurchasePrice) || undefined,
      sellingPrice: parseFloat(newItemSellingPrice) || undefined,
      initialStock: initStock,
    });

    setIsSubmitting(false);

    if (res.success && res.item) {
      const cat = categories.find((c) => c.id === newItemCatId);
      const createdItem: ItemData = {
        id: res.item.id,
        name: res.item.name,
        sku: res.item.sku,
        unit: res.item.unit,
        currentStock: initStock,
        minStockThreshold: thresh,
        purchasePrice: parseFloat(newItemPurchasePrice) || null,
        sellingPrice: parseFloat(newItemSellingPrice) || null,
        categoryName: cat?.name || "General",
        categoryId: newItemCatId,
        isLowStock: initStock <= thresh,
        isOutOfStock: initStock <= 0,
      };

      setItems([createdItem, ...items]);
      setIsAddItemOpen(false);
      setNewItemName("");
      setNewItemSku("");
      setNewItemPurchasePrice("");
      setNewItemSellingPrice("");
      setNewItemInitialStock("0");
      toast.success("Inventory item added successfully");
    } else {
      toast.error(res.error || "Failed to create item");
    }
  };

  // Add Stock
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !stockQty) return;

    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) return;

    setIsSubmitting(true);

    const res = await addStockAction({
      itemId: activeItem.id,
      quantity: qty,
      supplier: stockSupplier || undefined,
      purchasePrice: parseFloat(stockPrice) || undefined,
      notes: stockNotes || undefined,
    });

    setIsSubmitting(false);

    if (res.success && res.result) {
      const newStock = Number(res.result.item.currentStock);
      setItems((prev) =>
        prev.map((i) =>
          i.id === activeItem.id
            ? {
                ...i,
                currentStock: newStock,
                isLowStock: newStock <= i.minStockThreshold,
                isOutOfStock: newStock <= 0,
              }
            : i
        )
      );
      setIsAddStockOpen(false);
      setStockQty("");
      setStockSupplier("");
      setStockPrice("");
      setStockNotes("");
      toast.success("Stock added successfully");
    } else {
      toast.error(res.error || "Failed to add stock");
    }
  };

  // Remove Stock
  const handleRemoveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !stockQty) return;

    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) return;

    setIsSubmitting(true);

    const res = await removeStockAction({
      itemId: activeItem.id,
      quantity: qty,
      removalReason,
      notes: stockNotes || undefined,
    });

    setIsSubmitting(false);

    if (res.success && res.result) {
      const newStock = Number(res.result.item.currentStock);
      setItems((prev) =>
        prev.map((i) =>
          i.id === activeItem.id
            ? {
                ...i,
                currentStock: newStock,
                isLowStock: newStock <= i.minStockThreshold,
                isOutOfStock: newStock <= 0,
              }
            : i
        )
      );
      setIsRemoveStockOpen(false);
      setStockQty("");
      setStockNotes("");
      toast.success("Stock removed successfully");
    } else {
      toast.error(res.error || "Failed to remove stock");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 break-words">
            {t("inventoryTitle")}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 break-words">
            {t("inventorySubtitle")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <Link
            href="/inventory/history"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition min-h-[44px]"
          >
            <History className="h-4 w-4 shrink-0" />
            <span>{t("movementHistoryBtn")}</span>
          </Link>

          <button
            onClick={() => setIsAddCategoryOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition min-h-[44px]"
          >
            <FolderPlus className="h-4 w-4 shrink-0 text-sky-600" />
            <span>{t("addCategoryBtn")}</span>
          </button>

          <button
            onClick={() => setIsAddItemOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-98 min-h-[44px]"
          >
            <Plus className="h-4 w-4 shrink-0 text-sky-400" />
            <span>{t("addNewItemBtn")}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards — 3 side-by-side on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-2 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[9px] sm:text-xs font-semibold text-slate-500 leading-tight block whitespace-nowrap">Total Items</span>
          <div className="mt-1 text-sm sm:text-2xl font-black text-slate-900 whitespace-nowrap">{items.length}</div>
          <p className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight block truncate">
            <span className="sm:hidden">{categories.length} cats</span><span className="hidden sm:inline">{t("acrossCategories", { count: categories.length })}</span>
          </p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50/70 p-2 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[9px] sm:text-xs font-bold text-amber-800 leading-tight block whitespace-nowrap">Low Stock</span>
          <div className="mt-1 text-sm sm:text-2xl font-black text-amber-900 whitespace-nowrap">{lowStockCount}</div>
          <p className="text-[9px] sm:text-[11px] text-amber-700 mt-0.5 leading-tight block truncate">{lowStockCount} low</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-red-200 bg-red-50/70 p-2 sm:p-5 shadow-xs min-w-0 overflow-hidden">
          <span className="text-[9px] sm:text-xs font-bold text-red-800 leading-tight block whitespace-nowrap">Out of Stock</span>
          <div className="mt-1 text-sm sm:text-2xl font-black text-red-900 whitespace-nowrap">{outOfStockCount}</div>
          <p className="text-[9px] sm:text-[11px] text-red-600 mt-0.5 leading-tight block truncate">Need restock</p>
        </div>
      </div>

      {/* Category Tabs & Search Bar — desktop horizontal (locked) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-2xl">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              selectedCategory === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("allItemsTab", { count: items.length })}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                selectedCategory === cat.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setShowLowStockOnly(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                !showLowStockOnly
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t("all")} ({items.length})
            </button>
            <button
              onClick={() => setShowLowStockOnly(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                showLowStockOnly
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t("lowStockOnlyFilter")} ({lowStockCount})
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchItemPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mobile: Category vertical list */}
      <div className="flex sm:hidden flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("searchItemPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2.5 text-sm focus:border-slate-900 focus:bg-white focus:outline-none min-h-[44px]"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLowStockOnly(false)} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition min-h-[44px] ${!showLowStockOnly ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600"}`}>{t("all")} ({items.length})</button>
          <button onClick={() => setShowLowStockOnly(true)} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition min-h-[44px] ${showLowStockOnly ? "bg-amber-500 text-white shadow-xs" : "bg-slate-100 text-slate-600"}`}>{t("lowStockOnlyFilter")}</button>
        </div>
        <div className="space-y-1.5">
          <button type="button" onClick={() => setSelectedCategory("ALL")} className={`w-full text-left flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition min-h-[44px] border cursor-pointer touch-manipulation ${selectedCategory==="ALL" ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "bg-slate-50 text-slate-700 border-slate-200 active:bg-slate-100 hover:bg-slate-100"}`}>
            <span>{t("allItemsTab", { count: items.length })}</span>
            <span className={`text-xs ${selectedCategory==="ALL"?"text-sky-300":"text-slate-400"}`}>→</span>
          </button>
          {categories.map((cat) => (
            <Link key={cat.id} href={`/inventory/category/${cat.id}`} className="w-full text-left flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition min-h-[44px] border bg-white text-slate-700 border-slate-200 active:bg-slate-50 hover:bg-slate-50 cursor-pointer touch-manipulation">
              <span className="truncate min-w-0 flex-1 pointer-events-none">{cat.name}</span>
              <span className="ml-2 text-xs shrink-0 pointer-events-none text-slate-400">→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Items — Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-sm text-slate-900 break-words">{item.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700 break-words">{item.categoryName}</span>
                    <span className="font-bold text-slate-600 break-words">{item.unit}</span>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold whitespace-nowrap ${item.isOutOfStock ? "bg-red-100 text-red-800" : item.isLowStock ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                  {item.isOutOfStock ? t("outOfStockBadge") : item.isLowStock ? t("lowStockBadge") : t("inStockBadge")}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Stock</div>
                  <div className="text-sm font-black text-slate-900 break-words">{formatNumber(item.currentStock, 1)}</div>
                  <div className="text-[10px] text-slate-400 break-words">Min {item.minStockThreshold}</div>
                </div>
                <div className="min-w-0 border-l border-slate-200 pl-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Price</div>
                  <div className="text-xs font-black text-slate-900 break-words">{item.sellingPrice ? formatCurrency(item.sellingPrice) : "-"}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setActiveItem(item); setIsAddStockOpen(true); }} className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">+ Add</button>
                <button onClick={() => { setActiveItem(item); setIsRemoveStockOpen(true); }} className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">- Remove</button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-600 break-words">No items found</div>
        )}
      </div>

      {/* Items Table — Desktop (≥768px) unchanged */}
      <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">{t("itemNameCol")}</th>
              <th className="px-6 py-4">{t("categoryCol")}</th>
              <th className="px-6 py-4 text-center">{t("unitCol")}</th>
              <th className="px-6 py-4 text-center">{t("currentStockCol")}</th>
              <th className="px-6 py-4 text-right">{t("sellingPriceCol")}</th>
              <th className="px-6 py-4 text-center">{t("statusCol")}</th>
              <th className="px-6 py-4 text-right">{t("stockActionsCol")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-4">
                    <div className="font-extrabold text-sm text-slate-900">{item.name}</div>
                  </td>

                  <td className="px-6 py-4 text-slate-600 font-medium">{item.categoryName}</td>

                  <td className="px-6 py-4 text-center font-bold text-slate-700">{item.unit}</td>

                  <td className="px-6 py-4 text-center">
                    <span className="font-black text-sm text-slate-900">
                      {formatNumber(item.currentStock, 1)}
                    </span>
                    <div className="text-[10px] text-slate-400">Min: {item.minStockThreshold}</div>
                  </td>

                  <td className="px-6 py-4 text-right font-black text-slate-900">
                    {item.sellingPrice ? formatCurrency(item.sellingPrice) : "-"}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                        item.isOutOfStock
                          ? "bg-red-100 text-red-800"
                          : item.isLowStock
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.isLowStock && <AlertTriangle className="h-3 w-3" />}
                      {item.isOutOfStock ? t("outOfStockBadge") : item.isLowStock ? t("lowStockBadge") : t("inStockBadge")}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setIsAddStockOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>{t("addStockActionBtn")}</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setIsRemoveStockOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                        <span>{t("removeStockActionBtn")}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  {t("noItemsFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD CATEGORY MODAL */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">{t("createCategoryTitle")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t("createCategorySubtitle")}</p>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("categoryNameLabel")} *</label>
                <input
                  type="text"
                  required
                  placeholder={t("categoryNamePlaceholder")}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("saveCategoryBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">{t("addItemModalTitle")}</h3>

            <form onSubmit={handleCreateItem} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">{t("itemNameLabel")} *</label>
                <input
                  type="text"
                  required
                  placeholder={t("itemNamePlaceholder")}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t("itemCategoryLabel")} *</label>
                  <select
                    value={newItemCatId}
                    onChange={(e) => setNewItemCatId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t("itemSkuLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("itemSkuPlaceholder")}
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t("itemUnitLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("itemUnitPlaceholder")}
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t("minStockThresholdLabel")}</label>
                  <input
                    type="number"
                    value={newItemThreshold}
                    onChange={(e) => setNewItemThreshold(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t("purchasePriceLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItemPurchasePrice}
                    onChange={(e) => setNewItemPurchasePrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t("sellingPriceLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItemSellingPrice}
                    onChange={(e) => setNewItemSellingPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t("initialStockLabel")}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItemInitialStock}
                    onChange={(e) => setNewItemInitialStock(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("saveItemBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STOCK MODAL */}
      {isAddStockOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">
              {t("addStockModalTitle", { name: activeItem.name })}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("currentStockDisplay", { stock: activeItem.currentStock, unit: activeItem.unit })}
            </p>

            <form onSubmit={handleAddStock} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t("qtyToAddLabel", { unit: activeItem.unit })} *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 50"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-emerald-600 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("supplierLabel")}</label>
                <input
                  type="text"
                  placeholder={t("supplierPlaceholder")}
                  value={stockSupplier}
                  onChange={(e) => setStockSupplier(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("costPriceLabel")}</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={activeItem.purchasePrice ? activeItem.purchasePrice.toString() : "0.00"}
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("notes")}</label>
                <input
                  type="text"
                  placeholder="e.g. Morning delivery invoice"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStockOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("commitStockInflowBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE STOCK MODAL */}
      {isRemoveStockOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">
              {t("removeStockModalTitle", { name: activeItem.name })}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("currentStockDisplay", { stock: activeItem.currentStock, unit: activeItem.unit })}
            </p>

            <form onSubmit={handleRemoveStock} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t("qtyToRemoveLabel", { unit: activeItem.unit })} *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 20"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-red-600 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("removalReasonLabel")} *</label>
                <select
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value as StockRemovalReason)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value={StockRemovalReason.SOLD}>{t("reasonSold")}</option>
                  <option value={StockRemovalReason.DAMAGED}>{t("reasonDamaged")}</option>
                  <option value={StockRemovalReason.LOST}>{t("reasonLost")}</option>
                  <option value={StockRemovalReason.RETURNED}>{t("reasonReturned")}</option>
                  <option value={StockRemovalReason.ADJUSTMENT}>{t("reasonAdjustment")}</option>
                  <option value={StockRemovalReason.OTHER}>{t("reasonOther")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t("notes")}</label>
                <input
                  type="text"
                  placeholder="e.g. Direct cash sale or bag torn"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRemoveStockOpen(false)}
                  className="w-1/3 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("commitStockRemovalBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
