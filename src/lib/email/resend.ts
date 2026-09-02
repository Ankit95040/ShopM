import { Resend } from "resend";
import type { EmailProvider } from "./provider";
import type { FeedbackType } from "@prisma/client";

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
    try {
      const typeLabel = type === "FEATURE_REQUEST" ? "Feature Request"
        : type === "BUG" ? "Bug Report"
        : "General Feedback";

      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: `[ShopM Feedback] ${typeLabel} from ${userName}`,
        html: this.buildFeedbackEmailHtml({ typeLabel, message, shopId, userName, userId, pagePath, createdAt }),
        text: this.buildFeedbackEmailText({ typeLabel, message, shopId, userName, userId, pagePath, createdAt }),
      });

      if (error) {
        console.error("[ResendEmailProvider] Feedback email failed:", error);
        return { success: false, error: "Failed to send feedback email." };
      }

      return { success: true };
    } catch (err) {
      console.error("[ResendEmailProvider] Feedback email error:", err);
      return { success: false, error: "Failed to send feedback email." };
    }
  }

  private buildFeedbackEmailHtml({ typeLabel, message, shopId, userName, userId, pagePath, createdAt }: {
    typeLabel: string;
    message: string;
    shopId: string;
    userName: string;
    userId: string;
    pagePath: string | null;
    createdAt: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShopM Feedback</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
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
                    <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.3;">New Feedback: ${typeLabel}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:bold;">Type</td>
                  <td style="padding:8px 0;font-size:13px;color:#1e293b;">${typeLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:bold;">User</td>
                  <td style="padding:8px 0;font-size:13px;color:#1e293b;">${userName} (${userId})</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:bold;">Shop</td>
                  <td style="padding:8px 0;font-size:13px;color:#1e293b;">${shopId}</td>
                </tr>
                ${pagePath ? `<tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:bold;">Page</td>
                  <td style="padding:8px 0;font-size:13px;color:#1e293b;">${pagePath}</td>
                </tr>` : ""}
                <tr>
                  <td style="padding:8px 0;font-size:13px;color:#64748b;font-weight:bold;">Time</td>
                  <td style="padding:8px 0;font-size:13px;color:#1e293b;">${createdAt}</td>
                </tr>
              </table>
              <div style="background-color:#f1f5f9;border-radius:12px;padding:20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
                <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
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

  private buildFeedbackEmailText({ typeLabel, message, shopId, userName, userId, pagePath, createdAt }: {
    typeLabel: string;
    message: string;
    shopId: string;
    userName: string;
    userId: string;
    pagePath: string | null;
    createdAt: string;
  }): string {
    return [
      `New Feedback: ${typeLabel}`,
      ``,
      `Type: ${typeLabel}`,
      `User: ${userName} (${userId})`,
      `Shop: ${shopId}`,
      pagePath ? `Page: ${pagePath}` : null,
      `Time: ${createdAt}`,
      ``,
      `Message:`,
      message,
      ``,
      `— ShopM`,
    ].filter(Boolean).join("\n");
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
