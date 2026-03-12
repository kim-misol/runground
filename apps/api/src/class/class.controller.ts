import { Controller, Post, Body, Param, UseGuards, Request, Get } from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoachGuard } from '../auth/coach.guard';
import { ClassCoachGuard } from '../auth/class-coach.guard';

@Controller('classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  // 클래스 생성 — 유효한 COACH_GRADE Entitlement 보유자 또는 ADMIN
  @UseGuards(JwtAuthGuard, CoachGuard)
  @Post()
  async createClass(@Body() body: any, @Request() req: any) {
    return this.classService.createClass(body, req.user.sub);
  }

  // 전체 클래스 조회
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllClasses() {
    return this.classService.getAllClasses();
  }

  // 내 클래스 목록 조회
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyClasses(@Request() req: any) {
    return this.classService.getMyClasses(req.user.sub);
  }

  // 특정 클래스 상세 조회
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getClassDetails(@Param('id') classId: string) {
    return this.classService.getClassDetails(classId);
  }

  // 클래스 구독 신청 — 로그인 유저 누구나 (승인 대기 상태로 생성)
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinClass(@Param('id') classId: string, @Request() req: any) {
    return this.classService.joinClass(classId, req.user.sub);
  }

  // 훈련 이벤트 생성 — 해당 클래스의 HEAD_COACH 또는 COACH만 허용
  @UseGuards(JwtAuthGuard, ClassCoachGuard)
  @Post(':id/events')
  async createEvent(@Param('id') classId: string, @Body() body: any, @Request() req: any) {
    return this.classService.createEvent(classId, req.user.sub, body);
  }

  // 훈련 이벤트 목록 조회
  @UseGuards(JwtAuthGuard)
  @Get(':id/events')
  async getClassEvents(@Param('id') classId: string) {
    return this.classService.getClassEvents(classId);
  }
}
