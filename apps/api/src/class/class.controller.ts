import { Controller, Post, Body, Param, UseGuards, Request, Get } from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('classes') // /api/classes 로 연결됨
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  // 클래스 생성 (ADMIN 권한 필요)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createClass(@Body() body: any, @Request() req: any) {
    // req.user.sub 에는 토큰에서 해독한 userId가 들어있습니다.
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

  // 클래스 구독 (로그인한 유저 누구나 가능)
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinClass(@Param('id') classId: string, @Request() req: any) {
    return this.classService.joinClass(classId, req.user.sub);
  }

  // 코치(ADMIN)만 훈련 일정을 만들 수 있음
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/events')
  async createEvent(@Param('id') classId: string, @Body() body: any, @Request() req: any) {
    // req.user.sub(코치 ID)를 반드시 넘겨주어야 합니다.
    return this.classService.createEvent(classId, req.user.sub, body);
  }

  // 클래스 멤버라면 누구나 훈련 일정을 조회할 수 있음
  @UseGuards(JwtAuthGuard)
  @Get(':id/events')
  async getClassEvents(@Param('id') classId: string) {
    return this.classService.getClassEvents(classId);
  }
}