"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/ToastContext";
import { deleteMyAccountAction } from "@/server/actions/auth.actions";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset confirmation input on open
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isDeleting, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const canDelete = typed === "DELETE" && !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteMyAccountAction();
      if (res.success) {
        toast.success("Your account has been deleted. Signing you out.");
        onClose();
        router.push("/login");
        router.refresh();
        // Hard redirect fallback to ensure cookie cleared
        setTimeout(() => {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard redirect after account deletion to clear client state
          window.location.assign("/login");
        }, 600);
      } else {
        toast.error(res.error || "Failed to delete account.");
      }
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl max-h-[calc(100dvh-32px)] overflow-y-auto"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="delete-account-title" className="text-lg font-black text-slate-900">
              Delete your account?
            </h3>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-700">This will permanently remove your ShopM user account and sign you out.</p>
              <p>
                Your <span className="font-bold text-slate-900">shop, customers, billing records, inventory, transactions, and other users will NOT be deleted.</span>
              </p>
              <p className="font-bold text-red-600">This action cannot be undone.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100 transition shrink-0 disabled:opacity-50"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="delete-confirm-input" className="block text-xs font-bold text-slate-700 mb-2">
              Type <span className="font-black text-slate-900">DELETE</span> to confirm
            </label>
            <input
              ref={inputRef}
              id="delete-confirm-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value.trim())}
              placeholder="DELETE"
              autoComplete="off"
              spellCheck={false}
              disabled={isDeleting}
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-mono font-bold tracking-widest text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-xs hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition min-h-[44px]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
