import { Resend } from "resend";
import type { EmailProvider } from "./provider";

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || "");
    this.fromEmail = process.env.EMAIL_FROM || "ShopM <onboarding@resend.dev>";
  }

  async sendOtpEmail({ to, otp, userName }: { to: string; otp: string; userName: string }) {
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: "ShopM Password Reset OTP",
        html: this.buildOtpEmailHtml(userName, otp),
        text: this.buildOtpEmailText(userName, otp),
      });

      if (error) {
        console.error("[ResendEmailProvider] Send failed:", error);
        return { success: false, error: "Failed to send verification email. Please try again." };
      }

      return { success: true };
    } catch (err) {
      console.error("[ResendEmailProvider] Send error:", err);
      return { success: false, error: "Failed to send verification email. Please try again." };
    }
  }

  private buildOtpEmailHtml(userName: string, otp: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShopM Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:#334155;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:900;color:#ffffff;letter-spacing:0.5px;">SM</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:20px;">
                    <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.3;">Password Reset Request</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
                Hi <strong style="color:#1e293b;">${userName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                We received a request to reset your ShopM account password. Use the verification code below:
              </p>

              <!-- OTP Code -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <div style="background-color:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:20px 32px;display:inline-block;">
                      <span style="font-size:32px;font-weight:900;color:#0f172a;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:14px;color:#64748b;line-height:1.6;text-align:center;">
                This OTP expires in <strong>5 minutes</strong>.
              </p>
              <p style="margin:0 0 0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                ShopM — Shop Management &amp; Khata System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildOtpEmailText(userName: string, otp: string): string {
    return [
      `Hi ${userName},`,
      ``,
      `Your ShopM verification code is: ${otp}`,
      ``,
      `This OTP expires in 5 minutes. Do not share this code.`,
      ``,
      `If you did not request a password reset, you can safely ignore this email.`,
      ``,
      `— ShopM`,
    ].join("\n");
  }
}
