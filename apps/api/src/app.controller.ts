import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  root(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  health(): string {
    return this.appService.getHello();
  }
}
