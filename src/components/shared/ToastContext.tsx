"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, AlertCircle, Undo2, X } from "lucide-react";

export interface Toast {
  id: string;
  type: "success" | "error" | "undo";
  message: string;
  duration: number;
  onUndo?: () => void;
}

interface ToastContextValue {
  success: (message: string, options?: { duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
  undo: (message: string, onUndo: () => void, options?: { duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS = {
  success: 3500,
  error: 6000,
  undo: 10000,
} as const;

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (
      type: Toast["type"],
      message: string,
      options?: { duration?: number; onUndo?: () => void }
    ) => {
      const id = `toast-${++toastCounter}`;
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];

      const toast: Toast = {
        id,
        type,
        message,
        duration,
        onUndo: options?.onUndo,
      };

      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, options?: { duration?: number }) => {
      addToast("success", message, options);
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: { duration?: number }) => {
      addToast("error", message, options);
    },
    [addToast]
  );

  const undo = useCallback(
    (message: string, onUndo: () => void, options?: { duration?: number }) => {
      addToast("undo", message, { ...options, onUndo });
    },
    [addToast]
  );

  const dismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ success, error, undo, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [remaining, setRemaining] = useState(Math.round(toast.duration / 1000));

  useEffect(() => {
    if (toast.type !== "undo") return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [toast.type]);

  const borderColor =
    toast.type === "success"
      ? "border-emerald-200"
      : toast.type === "error"
      ? "border-red-200"
      : "border-slate-200";

  return (
    <div className="animate-toast-in">
      <div
        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-lg ${borderColor}`}
      >
        {toast.type === "success" && (
          <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
        )}
        {toast.type === "error" && (
          <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
        )}
        {toast.type === "undo" && (
          <CheckCircle className="h-4.5 w-4.5 text-slate-500 shrink-0" />
        )}

        <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0">
          {toast.message}
        </span>

        {toast.type === "undo" && toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo!();
              onDismiss(toast.id);
            }}
            disabled={remaining <= 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition active:scale-95 shrink-0 disabled:opacity-50"
          >
            <Undo2 className="h-3 w-3" />
            Undo ({remaining}s)
          </button>
        )}

        {toast.type !== "undo" && (
          <button
            onClick={() => onDismiss(toast.id)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
