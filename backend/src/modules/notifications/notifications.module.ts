import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { OrderNotificationListener } from './listeners/order-notification.listener';

@Module({
  imports: [ConfigModule],
  providers: [NotificationsService, OrderNotificationListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
