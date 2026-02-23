import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { prisma as db } from '@runground/db';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async signup(dto: any) {
    const { email, password, name } = dto;

    // 1. 이메일 중복 체크 (DB에 이미 있는지 확인)
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다.'); // 409 에러 발생
    }

    // 2. 비밀번호 암호화 (bcrypt)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 유저 및 프로필 생성 (V2 스키마 구조)
    const newUser = await db.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        profile: {
          create: { name },
        },
      },
    });

    // 4. 보안을 위해 반환값에서 비밀번호 해시 제외
    const { passwordHash, ...result } = newUser;
    return result;
  }

  async login(dto: any) {
    const { email, password } = dto;

    // 1. 유저 존재 여부 확인
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 2. 비밀번호 검증 (bcrypt.compare)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 3. JWT 토큰 발급
    const payload = { sub: user.id, email: user.email, role: user.globalRole };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
      }
    };
  }
}