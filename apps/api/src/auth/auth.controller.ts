import { Controller, Post, Body, HttpCode, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

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

  @UseGuards(JwtAuthGuard) // 🛡️ 문지기
  @Get('me')
  async getMe(@Request() req: any) {
    // 문지기를 통과했다면, req.user에는 JWT에서 해독한 정보(sub, email 등)가 들어있습니다.
    // sub(subject)에 담아둔 userId를 사용해 DB에서 최신 정보를 가져옵니다.
    return this.authService.getMe(req.user.sub);
  }
}