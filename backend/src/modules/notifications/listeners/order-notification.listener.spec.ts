import { OrderNotificationListener } from './order-notification.listener';
import { OrderCreatedEvent } from '../events/order-created.event';
import type { NotificationsService } from '../notifications.service';

describe('OrderNotificationListener', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('recipient olmadıqda email göndərmir', async () => {
    const sendEmailMock = jest.fn();
    const notificationsService = {
      sendEmail: sendEmailMock,
    } as unknown as NotificationsService;
    const listener = new OrderNotificationListener(notificationsService);
    const event = new OrderCreatedEvent(
      'order-1',
      'Bakı filialı',
      'branch-1',
      120.5,
      new Date('2024-01-10T12:00:00Z'),
      'user@example.com',
      [
        {
          code: 'PRD001',
          name: 'Məhsul 1',
          quantity: 2,
          unitPrice: 25,
          lineTotal: 50,
        },
      ],
      [],
    );

    await listener.handleOrderCreated(event);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('recipient siyahısı dolu olduqda hər kəsə email göndərir', async () => {
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const notificationsService = {
      sendEmail,
    } as unknown as NotificationsService;
    const listener = new OrderNotificationListener(notificationsService);
    const event = new OrderCreatedEvent(
      'order-2',
      'Gəncə filialı',
      'branch-2',
      300,
      new Date('2024-02-15T09:30:00Z'),
      'manager@example.com',
      [
        {
          code: 'PRD002',
          name: 'Məhsul 2',
          quantity: 3,
          unitPrice: 40,
          lineTotal: 120,
        },
        {
          code: 'PRD003',
          name: 'Məhsul 3',
          quantity: 4,
          unitPrice: 45,
          lineTotal: 180,
        },
      ],
      ['manager@example.com', 'branch@example.com'],
    );

    await listener.handleOrderCreated(event);

    expect(sendEmail).toHaveBeenCalledTimes(2);

    const calls = sendEmail.mock.calls as Array<[string, string, string]>;
    const [recipient, subject, body] = calls[0];
    expect(recipient).toBe('manager@example.com');
    expect(subject).toBe('Yeni sifariş təsdiqləndi — Gəncə filialı');
    expect(body).toContain('Yeni sifariş təsdiqləndi: order-2');
    expect(body).toContain('• PRD002 – Məhsul 2 (x3)');
    expect(body).toContain('Ümumi məbləğ: 300.00 AZN');
    expect(body).toContain('Tarix:');
  });
});
