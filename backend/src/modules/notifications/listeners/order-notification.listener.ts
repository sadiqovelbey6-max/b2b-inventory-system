import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { OrderCreatedEvent } from '../events/order-created.event';

@Injectable()
export class OrderNotificationListener {
  private readonly logger = new Logger(OrderNotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    if (!event.recipients.length) {
      this.logger.debug(
        `Order ${event.orderId} üçün bildiriş göndərilməyəcək, recipient siyahısı boşdur`,
      );
      return;
    }

    const subject = `Yeni sifariş təsdiqləndi — ${event.branchName}`;
    const lines = event.items.map(
      (item) =>
        `• ${item.code} – ${item.name} (x${item.quantity}) : ${item.lineTotal.toFixed(2)} AZN`,
    );
    const body = [
      `Salam,`,
      ``,
      `Yeni sifariş təsdiqləndi: ${event.orderId}`,
      `Filial: ${event.branchName}`,
      `Ümumi məbləğ: ${event.total.toFixed(2)} AZN`,
      ``,
      `Məhsullar:`,
      ...lines,
      ``,
      `Tarix: ${event.createdAt.toLocaleString('az-AZ')}`,
      ``,
      `B2B inventar sistemi`,
    ].join('\n');

    await Promise.all(
      event.recipients.map((recipient) =>
        this.notificationsService.sendEmail(recipient, subject, body),
      ),
    );
  }
}
