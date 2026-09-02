"use client";

import { useEffect, useState, useCallback } from "react";
import { Undo2 } from "lucide-react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  duration?: number;
}

export function UndoToast({
  message,
  onUndo,
  duration = 10000,
}: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration / 1000);
  const [visible, setVisible] = useState(true);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      setVisible(false);
    }, duration);
    return () => clearTimeout(timeout);
  }, [duration, visible]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-lg">
        <span className="text-sm font-semibold text-slate-700">{message}</span>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onUndo();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition active:scale-95"
        >
          <Undo2 className="h-3 w-3" />
          Undo ({remaining}s)
        </button>
      </div>
    </div>
  );
}
