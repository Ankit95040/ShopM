"use server";

import { db } from "@/server/db";
import { getCurrentSession } from "@/server/auth";
import { FeedbackType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getEmailProvider } from "@/lib/email/provider";
import { withPerformance } from "@/lib/performance";

async function submitFeedbackImpl({
  type,
  message,
  pagePath,
}: {
  type: FeedbackType;
  message: string;
  pagePath?: string;
}) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "You must be logged in to submit feedback." };
  }

  if (!message.trim()) {
    return { success: false, error: "Message is required." };
  }

  try {
    const feedback = await db.feedback.create({
      data: {
        shopId: session.shopId,
        userId: session.userId,
        type,
        message: message.trim(),
        pagePath: pagePath || null,
      },
    });

    // Send email notification (non-blocking, failures logged server-side)
    const feedbackEmail = process.env.SHOPM_FEEDBACK_EMAIL;
    if (feedbackEmail) {
      try {
        const emailProvider = getEmailProvider();
        await emailProvider.sendFeedbackEmail({
          to: feedbackEmail,
          type,
          message: message.trim(),
          shopId: session.shopId,
          userName: session.userName,
          userId: session.userId,
          pagePath: pagePath || null,
          createdAt: feedback.createdAt.toISOString(),
        });
      } catch (emailError) {
        console.error("[Feedback] Failed to send email notification:", emailError);
      }
    }

    revalidatePath("/");

    return { success: true, feedbackId: feedback.id };
  } catch (error) {
    console.error("[Feedback] Submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit feedback.",
    };
  }
}
export const submitFeedback = withPerformance("submitFeedback", "action", submitFeedbackImpl);
