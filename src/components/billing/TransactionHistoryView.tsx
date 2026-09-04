"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, FileText, Plus, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { CustomerAccountData, TransactionItem } from "@/components/billing/CustomerLedgerView";
import { softDeleteTransactionAction, restoreTransactionAction, editTransactionAction, addDebtAction, addPaymentAction } from "@/server/actions/transaction.actions";
import { PaymentMethod } from "@prisma/client";
import { useToast } from "@/components/shared/ToastContext";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { getBillImageSignedUrl } from "@/server/actions/upload.actions";
import { ImageViewer } from "@/components/shared/ImageViewer";

export function TransactionHistoryView({ data: initialData, locationId }: { data: CustomerAccountData; locationId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editBillNo, setEditBillNo] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [editChangeReason, setEditChangeReason] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDesc, setDebtDesc] = useState("");
  const [debtBillNo, setDebtBillNo] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentDesc, setPaymentDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sorted = [...data.allTransactions].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime() - (b.id.localeCompare(a.id) ? 0 : 0));
  // Compute running balance per transaction for display (ascending order)
  const ascending = [...data.allTransactions].sort((a,b)=> new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() || a.id.localeCompare(b.id));
  const balanceMap = new Map<string, number>();
  let bal = 0;
  for (const tx of ascending) {
    bal = tx.type === "DEBT" ? bal + tx.amount : bal - tx.amount;
    balanceMap.set(tx.id, bal);
  }

  const handleViewBillImage = async (tx: TransactionItem) => {
    if (tx.billImageKey) {
      const res = await getBillImageSignedUrl({ transactionId: tx.id, customerId: data.customer.id });
      if (res.success && res.url) setSelectedImage(res.url);
      else toast.error(res.error || "Failed to load bill image");
    } else if (tx.billImageUrl) setSelectedImage(tx.billImageUrl);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await softDeleteTransactionAction({ transactionId: deleteTarget.id, reason: "Deleted by user" });
      if (!res.success) {
        toast.error(res.error || "Failed to delete. Please try again.");
        return;
      }
      setData((prev) => {
        const isDebt = deleteTarget.type === "DEBT";
        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalDebt: isDebt ? prev.summary.totalDebt - deleteTarget.amount : prev.summary.totalDebt,
            totalReceived: !isDebt ? prev.summary.totalReceived - deleteTarget.amount : prev.summary.totalReceived,
            outstandingBalance: isDebt ? prev.summary.outstandingBalance - deleteTarget.amount : prev.summary.outstandingBalance + deleteTarget.amount,
            transactionCount: prev.summary.transactionCount - 1,
          },
          debtTransactions: prev.debtTransactions.filter(t=>t.id!==deleteTarget.id),
          paymentTransactions: prev.paymentTransactions.filter(t=>t.id!==deleteTarget.id),
          allTransactions: prev.allTransactions.filter(t=>t.id!==deleteTarget.id),
        };
      });
      router.refresh();
      const id = deleteTarget.id;
      toast.undo("Transaction deleted", async () => {
        const r = await restoreTransactionAction(id);
        if (r.success) router.refresh();
      });
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditBillNo(tx.billNumber || "");
    setEditDesc(tx.description || "");
    setEditPaymentMethod((tx.paymentMethod as PaymentMethod) || PaymentMethod.CASH);
    setEditChangeReason("");
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt<=0) { toast.error("Amount must be greater than zero"); return; }
    if (!editChangeReason.trim()) { toast.error("Change reason required"); return; }
    setIsEditSubmitting(true);
    try {
      const res = await editTransactionAction({ transactionId: editingTx.id, amount: amt, billNumber: editingTx.type==="DEBT"?editBillNo:undefined, paymentMethod: editingTx.type==="PAYMENT_RECEIVED"?editPaymentMethod:undefined, description: editDesc||undefined, changeReason: editChangeReason.trim() });
      if (!res.success || !res.transaction) {
        toast.error(res.error||"Failed to edit. Please try again.");
        return;
      }
      const updated: TransactionItem = { ...editingTx, amount: amt, billNumber: editingTx.type==="DEBT"?editBillNo||null:editingTx.billNumber, paymentMethod: editingTx.type==="PAYMENT_RECEIVED"?editPaymentMethod:editingTx.paymentMethod, description: editDesc||null };
      setData(prev=>{
        const replace=(arr:TransactionItem[])=>arr.map(t=>t.id===editingTx.id?updated:t);
        const diff = amt - editingTx.amount;
        const isDebt = editingTx.type==="DEBT";
        return {
          ...prev,
          summary:{ ...prev.summary, totalDebt: isDebt?prev.summary.totalDebt+diff:prev.summary.totalDebt, totalReceived: !isDebt?prev.summary.totalReceived+diff:prev.summary.totalReceived, outstandingBalance: isDebt?prev.summary.outstandingBalance+diff:prev.summary.outstandingBalance-diff },
          debtTransactions: isDebt?replace(prev.debtTransactions):prev.debtTransactions,
          paymentTransactions: !isDebt?replace(prev.paymentTransactions):prev.paymentTransactions,
          allTransactions: replace(prev.allTransactions),
        };
      });
      router.refresh();
      toast.success("Transaction updated");
      setEditingTx(null);
    } catch (err) {
      console.error("Edit failed:", err);
      toast.error("Failed to edit. Please try again.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(debtAmount);
    if (isNaN(amt) || amt <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await addDebtAction({ customerId: data.customer.id, amount: amt, billNumber: debtBillNo||undefined, description: debtDesc||undefined, transactionDate: new Date() });
      if (!res.success || !res.transaction) {
        toast.error(res.error||"Failed to add debt. Please try again.");
        return;
      }
      const newTx: TransactionItem = { id: res.transaction.id, type: "DEBT", amount: amt, billNumber: debtBillNo||null, description: debtDesc||null, transactionDate: new Date(), createdByName: "You" };
      setData(prev=>({ ...prev, summary:{...prev.summary, totalDebt: prev.summary.totalDebt+amt, outstandingBalance: prev.summary.outstandingBalance+amt, transactionCount: prev.summary.transactionCount+1}, debtTransactions:[...prev.debtTransactions, newTx], allTransactions:[...prev.allTransactions, newTx]}));
      router.refresh();
      setIsAddDebtOpen(false); setDebtAmount(""); setDebtBillNo(""); setDebtDesc(""); toast.success("Bill added");
    } catch (err) {
      console.error("Add debt failed:", err);
      toast.error("Failed to add debt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt<=0) return;
    setIsSubmitting(true);
    try {
      const res = await addPaymentAction({ customerId: data.customer.id, amount: amt, paymentMethod, description: paymentDesc||undefined, transactionDate: new Date() });
      if (!res.success || !res.transaction) {
        toast.error(res.error||"Failed to add payment. Please try again.");
        return;
      }
      const newTx: TransactionItem = { id: res.transaction.id, type:"PAYMENT_RECEIVED", amount: amt, paymentMethod, description: paymentDesc||null, transactionDate: new Date(), createdByName:"You" };
      setData(prev=>({ ...prev, summary:{...prev.summary, totalReceived: prev.summary.totalReceived+amt, outstandingBalance: prev.summary.outstandingBalance-amt, transactionCount: prev.summary.transactionCount+1}, paymentTransactions:[...prev.paymentTransactions, newTx], allTransactions:[...prev.allTransactions, newTx]}));
      router.refresh();
      setIsAddPaymentOpen(false); setPaymentAmount(""); setPaymentDesc(""); toast.success("Payment added");
    } catch (err) {
      console.error("Add payment failed:", err);
      toast.error("Failed to add payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 pb-24 sm:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href={`/billing/${locationId}/customers/${data.customer.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 truncate">{data.customer.name}</h1>
          <p className="text-xs text-slate-500 truncate">{data.customer.phone} • {data.allTransactions.length} transactions</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No transactions yet</div>
        ) : (
          sorted.map(tx=>{
            const isDebt = tx.type==="DEBT";
            return (
              <div key={tx.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs min-w-0">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${isDebt?"bg-slate-900 text-white":"bg-emerald-100 text-emerald-800"}`}>{isDebt ? (tx.billNumber||"Bill") : (tx.paymentMethod||"Payment")}</span>
                      <span className="text-xs font-semibold text-slate-800 break-words min-w-0">{tx.description || (isDebt?"Purchase Bill":"Payment")}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-1.5">
                      <span>{formatDate(tx.transactionDate, "dd MMM yyyy, hh:mm a")}</span>
                      <span>•</span>
                      <span>Added by: {tx.createdByName}</span>
                    </div>
                    {tx.billImageKey && (
                      <button onClick={()=>handleViewBillImage(tx)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-600 mt-1"><FileText className="h-4 w-4"/></button>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm sm:text-base font-black whitespace-nowrap ${isDebt?"text-red-600":"text-emerald-600"}`}>{isDebt?"+":"-"}{formatCurrency(tx.amount)}</div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">Bal: {formatCurrency(balanceMap.get(tx.id) ?? 0)}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                  <button onClick={()=>openEdit(tx)} className="inline-flex h-11 flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 min-h-[44px]"><Pencil className="h-3.5 w-3.5"/> Edit</button>
                  <button onClick={()=>setDeleteTarget(tx)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 min-h-[44px]"><Trash2 className="h-4 w-4"/></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-900">Edit {editingTx.type==="DEBT"?"Bill":"Payment"}</h3>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Amount *</label>
                <input type="number" step="0.01" value={editAmount} onChange={e=>setEditAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black focus:border-slate-900 focus:outline-none" required />
              </div>
              {editingTx.type==="DEBT" ? (
                <div><label className="text-base sm:text-xs font-bold text-slate-700">Bill No</label><input value={editBillNo} onChange={e=>setEditBillNo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" /></div>
              ): (
                <div><label className="text-base sm:text-xs font-bold text-slate-700">Payment Method</label><select value={editPaymentMethod} onChange={e=>setEditPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs font-bold"><option value={PaymentMethod.CASH}>Cash</option><option value={PaymentMethod.UPI}>UPI</option><option value={PaymentMethod.BANK_TRANSFER}>Bank</option><option value={PaymentMethod.OTHER}>Other</option></select></div>
              )}
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Description</label><input value={editDesc} onChange={e=>setEditDesc(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" /></div>
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Change reason *</label><input value={editChangeReason} onChange={e=>setEditChangeReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" required /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setEditingTx(null)} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={isEditSubmitting} className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-50">{isEditSubmitting?"Saving...":"Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile floating Add Debt / Add Payment — same as customer page, phone only */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-3">
        <button onClick={()=>setIsAddDebtOpen(true)} className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-red-600 px-3 py-3 text-[13px] font-bold text-white shadow-lg hover:bg-red-700 active:scale-[0.98] transition whitespace-nowrap"><Plus className="h-4 w-4 shrink-0"/> Add Debt</button>
        <button onClick={()=>setIsAddPaymentOpen(true)} className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-3 text-[13px] font-bold text-white shadow-lg hover:bg-emerald-700 active:scale-[0.98] transition whitespace-nowrap"><ArrowDownLeft className="h-4 w-4 shrink-0"/> Add Payment</button>
      </div>

      {/* Add Debt Modal */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-900">Add Debt</h3>
            <form onSubmit={handleAddDebt} className="mt-4 space-y-3">
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Amount *</label><input type="number" step="0.01" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-red-600 focus:border-slate-900 focus:outline-none" required /></div>
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Bill No</label><input value={debtBillNo} onChange={e=>setDebtBillNo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" /></div>
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Description</label><input value={debtDesc} onChange={e=>setDebtDesc(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" /></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={()=>setIsAddDebtOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold">Cancel</button><button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">{isSubmitting?"Saving...":"Add Debt"}</button></div>
            </form>
          </div>
        </div>
      )}
      {/* Add Payment Modal */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-900">Add Payment</h3>
            <form onSubmit={handleAddPayment} className="mt-4 space-y-3">
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Amount *</label><input type="number" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-emerald-600 focus:border-slate-900 focus:outline-none" required /></div>
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Payment Method</label><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs font-bold"><option value={PaymentMethod.CASH}>Cash</option><option value={PaymentMethod.UPI}>UPI</option><option value={PaymentMethod.BANK_TRANSFER}>Bank</option><option value={PaymentMethod.OTHER}>Other</option></select></div>
              <div><label className="text-base sm:text-xs font-bold text-slate-700">Description</label><input value={paymentDesc} onChange={e=>setPaymentDesc(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base sm:text-xs focus:border-slate-900 focus:outline-none" /></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={()=>setIsAddPaymentOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold">Cancel</button><button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{isSubmitting?"Saving...":"Add Payment"}</button></div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} title="Delete transaction?" description={deleteTarget?`Are you sure you want to delete this ${deleteTarget.type==="DEBT"?"bill":"payment"} of ${formatCurrency(deleteTarget.amount)}?`: ""} confirmLabel="Delete" onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} isLoading={isDeleting} />
      <ImageViewer src={selectedImage||""} alt="Bill" isOpen={!!selectedImage} onClose={()=>setSelectedImage(null)} />
    </div>
  );
}