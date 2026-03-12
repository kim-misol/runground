import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { prisma as db } from '@runground/db';

/**
 * 특정 클래스 내 HEAD_COACH 또는 COACH 멤버만 통과.
 * 훈련 이벤트 생성, 멤버 수락/거절 등 클래스 수준 관리 엔드포인트에 사용.
 * request.params.id 가 classId 로 바인딩되어 있어야 한다.
 */
@Injectable()
export class ClassCoachGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;
    const classId: string = request.params.id;

    if (!userId) throw new ForbiddenException();
    if (request.user?.role === 'ADMIN') return true;

    const membership = await db.classMembership.findFirst({
      where: {
        classId,
        userId,
        role: { in: ['HEAD_COACH', 'COACH'] },
        memberStatus: 'ACTIVE',
      },
    });

    if (!membership) throw new ForbiddenException('클래스 코치 권한이 필요합니다.');
    return true;
  }
}
