export interface EmailProvider {
  sendOtpEmail(params: {
    to: string;
    otp: string;
    userName: string;
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
}
