import { Module } from '@nestjs/common';
import { ZeppController } from './zepp.controller';
import { ZeppService } from './zepp.service';

@Module({
  controllers: [ZeppController],
  providers: [ZeppService],
  exports: [ZeppService],
})
export class ZeppModule {}
