import { Module } from "@nestjs/common";
import { CreditsController } from "./credits.controller";
import { CreditsService } from "./credits.service";
import { PrismaService } from "../prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [AuthModule, MailModule],
  controllers: [CreditsController],
  providers: [CreditsService, PrismaService],
  exports: [CreditsService],
})
export class CreditsModule {}
