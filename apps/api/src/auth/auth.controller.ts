import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth') // /api/auth 로 연결됨
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup') // /api/auth/signup
  async signup(@Body() body: any) {
    return this.authService.signup(body);
  }
  
  @Post('login')
  @HttpCode(200) // POST 요청은 기본적으로 201을 반환하지만, 로그인은 200 OK가 표준입니다.
  async login(@Body() body: any) {
    return this.authService.login(body);
  }
}