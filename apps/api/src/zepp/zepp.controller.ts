import {
  Controller,
  Get,
  Post,
  Query,
  Redirect,
  Request,
  UseGuards,
  Delete,
  Body,
} from '@nestjs/common';
import { ZeppService } from './zepp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('zepp')
export class ZeppController {
  constructor(private readonly zeppService: ZeppService) {}

  /** GET /zepp/status — 현재 연결 상태 확인 */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Request() req: any) {
    return this.zeppService.getConnectionStatus(req.user.sub);
  }

  /**
   * GET /zepp/connect — Zepp OAuth 페이지로 리다이렉트.
   * 클라이언트는 이 URL을 브라우저/웹뷰에서 열면 된다.
   */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  @Redirect()
  connect(@Request() req: any) {
    const url = this.zeppService.buildAuthUrl(req.user.sub);
    return { url, statusCode: 302 };
  }

  /**
   * GET /zepp/callback — Zepp OAuth 콜백.
   * Zepp이 ?code=...&state=<userId> 로 리다이렉트함.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
  ) {
    await this.zeppService.handleCallback(code, userId);
    return { message: 'Zepp 계정이 성공적으로 연결되었습니다.' };
  }

  /**
   * POST /zepp/sync — 최근 활동 데이터 수동 동기화.
   * Body: { fromMs?: number }  (선택, 기본값: 7일 전)
   */
  @UseGuards(JwtAuthGuard)
  @Post('sync')
  sync(@Request() req: any, @Body('fromMs') fromMs?: number) {
    return this.zeppService.syncActivities(req.user.sub, fromMs);
  }

  /** DELETE /zepp/disconnect — Zepp 계정 연결 해제 */
  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect(@Request() req: any) {
    return this.zeppService.disconnect(req.user.sub);
  }
}
