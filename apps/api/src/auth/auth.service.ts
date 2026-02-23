import { Injectable, ConflictException } from '@nestjs/common';
import { prisma as db } from '@runground/db';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
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
}