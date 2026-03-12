import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { prisma as db } from '@runground/db';

/**
 * 클래스 생성 등 "코치 등급" 전역 권한이 필요한 엔드포인트에 사용.
 * ADMIN은 항상 통과. 일반 유저는 유효한 COACH_GRADE Entitlement 보유 시 통과.
 */
@Injectable()
export class CoachGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;

    if (!userId) throw new ForbiddenException();
    if (request.user?.role === 'ADMIN') return true;

    const entitlement = await db.entitlement.findFirst({
      where: {
        userId,
        type: 'COACH_GRADE',
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });

    if (!entitlement) throw new ForbiddenException('코치 권한이 필요합니다.');
    return true;
  }
}
