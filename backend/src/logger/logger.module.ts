import { Global, Module } from "@nestjs/common";
import { LoggerService } from "./logger.service";
import { LogsController } from "./logs.controller";

@Global()
@Module({
  controllers: [LogsController],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
