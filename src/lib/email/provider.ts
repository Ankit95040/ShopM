import type { FeedbackType } from "@prisma/client";

export interface EmailProvider {
  sendOtpEmail(params: {
    to: string;
    otp: string;
    userName: string;
  }): Promise<{ success: boolean; error?: string }>;

  sendFeedbackEmail(params: {
    to: string;
    type: FeedbackType;
    message: string;
    shopId: string;
    userName: string;
    userId: string;
    pagePath: string | null;
    createdAt: string;
  }): Promise<{ success: boolean; error?: string }>;
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  const apiKey = process.env.RESEND_API_KEY || "";

  if (apiKey) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ResendEmailProvider } = require("./resend") as { ResendEmailProvider: new () => EmailProvider };
    provider = new ResendEmailProvider();
  } else {
    // Development fallback — logs OTP to server console
    provider = new ConsoleEmailProvider();
  }

  return provider;
}

class ConsoleEmailProvider implements EmailProvider {
  async sendOtpEmail({ to, otp, userName }: { to: string; otp: string; userName: string }) {
    console.log(`\n[EMAIL DEV FALLBACK] To: ${to}`);
    console.log(`Hi ${userName}, your ShopM verification code is: ${otp}`);
    console.log(`This OTP expires in 5 minutes. Do not share this code.\n`);
    return { success: true };
  }

  async sendFeedbackEmail({ to, type, message, shopId, userName, userId, pagePath, createdAt }: {
    to: string;
    type: FeedbackType;
    message: string;
    shopId: string;
    userName: string;
    userId: string;
    pagePath: string | null;
    createdAt: string;
  }) {
    console.log(`\n[FEEDBACK EMAIL DEV FALLBACK] To: ${to}`);
    console.log(`Type: ${type}`);
    console.log(`Message: ${message}`);
    console.log(`Shop: ${shopId} | User: ${userName} (${userId})`);
    console.log(`Page: ${pagePath || "N/A"}`);
    console.log(`Time: ${createdAt}\n`);
    return { success: true };
  }
}
