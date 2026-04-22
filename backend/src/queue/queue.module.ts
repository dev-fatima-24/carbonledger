import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueueProcessor } from './queue.processor';
import { AuthModule } from '../auth/auth.module';
import { QUEUE_NAME } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAME }),
    AuthModule,
  ],
  providers: [QueueService, QueueProcessor],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
