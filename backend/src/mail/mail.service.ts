import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, MailEvent } from './mail.constants';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue(MAIL_QUEUE) private mailQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async sendEmail(to: string, event: MailEvent, payload: any) {
    // 1. Log the email attempt in DB
    const log = await this.prisma.emailLog.create({
      data: {
        to,
        template: event,
        subject: this.getSubject(event),
        status: 'Pending',
      },
    });

    // 2. Add to background queue
    await this.mailQueue.add(event, {
      logId: log.id,
      to,
      payload,
    });

    return log;
  }

  private getSubject(event: MailEvent): string {
    switch (event) {
      case MailEvent.PROJECT_APPROVED:
        return 'Project Approved - CarbonLedger';
      case MailEvent.CREDITS_MINTED:
        return 'Credits Minted Successfully';
      case MailEvent.RETIREMENT_CONFIRMED:
        return 'Retirement Confirmed & Certificate Attached';
      default:
        return 'Notification from CarbonLedger';
    }
  }
}
