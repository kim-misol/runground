import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    // 1. 토큰이 아예 없으면 401 에러
    if (!token) {
      throw new UnauthorizedException('토큰이 존재하지 않습니다.');
    }
    
    try {
      // 2. 토큰이 유효한지 검증 (비밀번호는 auth.module.ts에 적은 것과 일치해야 함)
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'super-secret-key-for-dev', // TODO: 🚨 실제 운영에서는 .env로 빼야 합니다!
      });
      
      // 3. 검증 성공 시, 요청(request) 객체에 유저 정보(payload)를 달아줍니다.
      request['user'] = payload;
    } catch {
      // 4. 토큰이 위조되었거나 만료되었으면 401 에러
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
    
    return true; // 무사히 통과!
  }

  // 헤더에서 'Bearer <token>' 형태의 토큰만 쏙 빼내는 헬퍼 함수
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}