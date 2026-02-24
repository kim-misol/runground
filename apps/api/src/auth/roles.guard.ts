import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 현재 요청된 API에 붙어있는 라벨(@Roles)을 확인합니다.
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. 만약 라벨이 안 붙어있다면 누구나 접근 가능한 곳이므로 통과시킵니다.
    if (!requiredRoles) {
      return true;
    }

    // 3. 1차 문지기(JwtAuthGuard)가 request 객체에 달아둔 user 정보(JWT Payload)를 가져옵니다.
    const { user } = context.switchToHttp().getRequest();

    // 4. 유저 정보가 없거나, 유저의 권한이 요구되는 권한에 포함되지 않으면 403 에러 발생!
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('이 리소스에 접근할 권한이 없습니다.');
    }

    return true; // 통과!
  }
}