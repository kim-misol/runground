import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    // JWT 발급을 위한 모듈 등록
    JwtModule.register({
      secret: 'super-secret-key-for-dev', // TODO: 🚨 실제 운영에서는 .env로 빼야 합니다!
      signOptions: { expiresIn: '1d' }, // 토큰 유효기간 (1일)
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}