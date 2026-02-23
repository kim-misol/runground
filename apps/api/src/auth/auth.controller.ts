import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth') // /api/auth 로 연결됨
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup') // /api/auth/signup
  async signup(@Body() body: any) {
    return this.authService.signup(body);
  }
}