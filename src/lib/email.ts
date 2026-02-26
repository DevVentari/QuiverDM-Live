/**
 * Email Service (Resend API)
 *
 * Lightweight transactional email sender for welcome, invite, and password reset emails.
 * If RESEND_API_KEY or EMAIL_FROM are not configured, methods no-op and return skipped.
 */

import { Resend } from 'resend';

type EmailSendResult = {
  sent: boolean;
  id?: string;
  error?: string;
};

type PasswordResetParams = {
  to: string;
  resetUrl: string;
  name?: string | null;
};

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3847';
}

class EmailService {
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from = process.env.EMAIL_FROM;
  private readonly client = this.apiKey ? new Resend(this.apiKey) : null;

  private isConfigured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return { sent: false, error: 'Email service not configured' };
    }

    try {
      const response = await this.client!.emails.send({
        from: this.from!,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (response.error) {
        return {
          sent: false,
          error: response.error.message || 'Email send failed',
        };
      }

      return {
        sent: true,
        id: response.data?.id,
      };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
      };
    }
  }

  async sendWelcomeEmail(params: { to: string; name?: string | null }): Promise<EmailSendResult> {
    const appUrl = getBaseUrl();
    const displayName = params.name || 'Adventurer';

    return this.send({
      to: params.to,
      subject: 'Welcome to QuiverDM',
      text: `Welcome to QuiverDM, ${displayName}. Start here: ${appUrl}/dashboard`,
      html: [
        `<p>Welcome to <strong>QuiverDM</strong>, ${displayName}.</p>`,
        `<p>Your account is ready. Open your dashboard to start your first session plan.</p>`,
        `<p><a href="${appUrl}/dashboard">Open Dashboard</a></p>`,
      ].join(''),
    });
  }

  async sendInviteCodeEmail(params: {
    to: string;
    code: string;
    expiresAt?: Date;
  }): Promise<EmailSendResult> {
    const appUrl = getBaseUrl();
    const expiresText = params.expiresAt
      ? `Expires on ${params.expiresAt.toLocaleDateString()}.`
      : 'No expiration date.';

    return this.send({
      to: params.to,
      subject: 'Your QuiverDM Beta Invite Code',
      text: `Your invite code is ${params.code}. ${expiresText} Sign up: ${appUrl}/auth/signup`,
      html: [
        '<p>Your QuiverDM beta invite code:</p>',
        `<p><strong style="font-size:18px;">${params.code}</strong></p>`,
        `<p>${expiresText}</p>`,
        `<p><a href="${appUrl}/auth/signup">Create your account</a></p>`,
      ].join(''),
    });
  }

  async sendPasswordResetEmail(params: PasswordResetParams): Promise<EmailSendResult> {
    const displayName = params.name || 'there';
    return this.send({
      to: params.to,
      subject: 'Reset your QuiverDM password',
      text: `Hi ${displayName}, reset your password here: ${params.resetUrl}`,
      html: [
        `<p>Hi ${displayName},</p>`,
        '<p>Use the link below to reset your password:</p>',
        `<p><a href="${params.resetUrl}">Reset Password</a></p>`,
      ].join(''),
    });
  }

  async sendUsageAlert(params: {
    userId: string;
    tier: string;
    limitFamily: string;
    used: number;
    limit: number;
    percentage: number;
    periodEnd: Date;
  }): Promise<void> {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (!adminEmails?.length) return;

    const subject = `[QuiverDM] Usage alert: ${params.limitFamily} at ${Math.round(params.percentage)}%`;
    const html = `
    <p><strong>Usage threshold alert</strong></p>
    <ul>
      <li>User: ${params.userId}</li>
      <li>Tier: ${params.tier}</li>
      <li>Limit: ${params.limitFamily}</li>
      <li>Used: ${params.used} / ${params.limit} (${Math.round(params.percentage)}%)</li>
      <li>Period ends: ${params.periodEnd.toISOString()}</li>
    </ul>
  `;

    for (const email of adminEmails) {
      await this.send({ to: email, subject, html, text: subject }).catch(() => {});
    }
  }
}

export const emailService = new EmailService();
