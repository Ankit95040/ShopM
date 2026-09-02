"use client";

import { useState } from "react";
import { DesktopFooter } from "@/components/shared/DesktopFooter";
import { HelpFeedbackModal } from "@/components/shared/HelpFeedbackModal";

export function HomepageShell({ children }: { children: React.ReactNode }) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <>
      {children}
      <DesktopFooter onOpenFeedback={() => setIsFeedbackOpen(true)} />
      <HelpFeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </>
  );
}
