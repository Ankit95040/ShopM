"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Loader2, CheckCircle2, Bug, Lightbulb, MessageCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/shared/ToastContext";
import { submitFeedback } from "@/server/actions/feedback.actions";
import { FeedbackType } from "@prisma/client";

interface HelpFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES = [
  { value: "FEATURE_REQUEST" as const, icon: Lightbulb, color: "text-amber-600" },
  { value: "BUG" as const, icon: Bug, color: "text-red-600" },
  { value: "GENERAL" as const, icon: MessageCircle, color: "text-sky-600" },
];

export function HelpFeedbackModal({ isOpen, onClose }: HelpFeedbackModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>("FEATURE_REQUEST");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error(t("feedbackEmptyMessage"));
      return;
    }

    setIsSubmitting(true);
    const result = await submitFeedback({
      type,
      message: message.trim(),
      pagePath: pathname,
    });
    setIsSubmitting(false);

    if (result.success) {
      setIsSubmitted(true);
      toast.success(t("feedbackSuccess"));
      setTimeout(() => {
        setIsSubmitted(false);
        setMessage("");
        setType("FEATURE_REQUEST");
        onClose();
      }, 1500);
    } else {
      toast.error(result.error || t("feedbackError"));
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsSubmitted(false);
      setMessage("");
      setType("FEATURE_REQUEST");
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
        onClick={handleClose}
      />

      {/* Modal — mobile: bottom-sheet, desktop: centered */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-sky-600" />
              <h2 className="text-base font-black text-slate-900">{t("helpAndFeedback")}</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 transition disabled:opacity-50"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-slate-900">{t("feedbackThankYou")}</p>
                <p className="text-xs text-slate-500 mt-1">{t("feedbackReceived")}</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{t("feedbackPrompt")}</p>

                {/* Type Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">{t("feedbackType")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FEEDBACK_TYPES.map(({ value, icon: Icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-bold transition min-h-[44px] ${
                          type === value
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${type === value ? color : "text-slate-400"}`} />
                        <span className="text-[10px] leading-tight text-center">
                          {value === "FEATURE_REQUEST" ? t("feedbackFeatureRequest") : value === "BUG" ? t("feedbackBug") : t("feedbackGeneral")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">{t("feedbackMessage")}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("feedbackPlaceholder")}
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!isSubmitted && (
            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !message.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("feedbackSubmitting")}
                  </>
                ) : (
                  t("feedbackSubmit")
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
