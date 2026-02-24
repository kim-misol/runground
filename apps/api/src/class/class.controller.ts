import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('classes') // /api/classes 로 연결됨
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  // 1. 클래스 생성 (ADMIN 권한 필요)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createClass(@Body() body: any, @Request() req: any) {
    // req.user.sub 에는 토큰에서 해독한 userId가 들어있습니다.
    return this.classService.createClass(body, req.user.sub);
  }

  // 2. 클래스 가입 (로그인한 유저 누구나 가능)
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinClass(@Param('id') classId: string, @Request() req: any) {
    return this.classService.joinClass(classId, req.user.sub);
  }
}