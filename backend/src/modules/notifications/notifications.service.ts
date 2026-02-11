import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer/lib/smtp-transport';

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter?: Transporter<SentMessageInfo>;
  private readonly from: string;
  private readonly enabled: boolean;
  private readonly mailConfig?: MailConfig;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port');
    const user = this.configService.get<string>('mail.user');
    const password = this.configService.get<string>('mail.password');
    const from =
      this.configService.get<string>('mail.from') ??
      'no-reply@b2b-inventory.local';
    const secure = this.configService.get<boolean>('mail.secure') ?? false;

    if (host && port && user && password) {
      this.mailConfig = { host, port, secure, user, password, from };
      this.transporter = createTransport({
        host,
        port,
        secure,
        auth: { user, pass: password },
      });
      this.enabled = true;
      this.from = from;
      return;
    }

    this.mailConfig = undefined;
    this.enabled = false;
    this.from = from;
    this.logger.warn(
      'SMTP konfiqurasiyası tam deyil, email bildirişləri deaktivdir',
    );
  }

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    if (!this.enabled || !this.transporter) {
      this.logger.log(
        `[DEV] Email mock => ${JSON.stringify({
          to,
          subject,
          text,
        })}`,
      );
      return;
    }

    try {
      const response: SentMessageInfo = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html ?? `<p>${text}</p>`,
      });
      this.logger.log(
        `E-poçt göndərildi: ${to} | ${subject} | messageId=${response.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `E-poçt göndərilə bilmədi (${to} | ${subject}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
