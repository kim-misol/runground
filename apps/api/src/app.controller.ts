import { Controller, Get } from '@nestjs/common';
import { prisma } from '@runground/db';

@Controller()
export class AppController {

  @Get('/health')
  health() {
    return { message: 'ok', data: [] };
  }
  
  @Get()
  async listClasses() {
    const data = await prisma.class.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return { message: 'ok', data };
  }
}